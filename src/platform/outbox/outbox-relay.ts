import type { EventBus } from '../event-bus/event-bus.interface.js';
import type { Logger } from '../../shared-kernel/logger.js';
import type { TransactionManager } from '../../shared-kernel/transaction.js';
import type { OutboxMetrics } from '../metrics/outbox-metrics.interface.js';
import type { Scheduler, ScheduledTaskHandle } from '../scheduler/scheduler.js';
import type { OutboxRepository } from './outbox.repository.js';
import { toDeliveredEvent, type OutboxMessage } from './outbox-message.js';

const MAX_ERROR_LENGTH = 1000;

const truncateError = (error: Error): string =>
  error.message.slice(0, MAX_ERROR_LENGTH);

export class OutboxRelay {
  private stopped = false;
  private readonly inFlight = new Set<Promise<void>>();
  private task?: ScheduledTaskHandle;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly eventBus: EventBus,
    private readonly transactionManager: TransactionManager,
    private readonly logger: Logger,
    private readonly metrics: OutboxMetrics,
    private readonly scheduler: Scheduler,
    private readonly cronExpression: string,
    private readonly maxRetries: number,
    private readonly batchSize = 50,
  ) {}

  start(): void {
    if (!this.cronExpression) {
      return;
    }

    this.task = this.scheduler.schedule(this.cronExpression, () =>
      this.runScheduledTick(),
    );
  }

  async runOnce(): Promise<void> {
    if (this.stopped) {
      return;
    }

    const run = this.executeRunOnce();
    this.inFlight.add(run);

    try {
      await run;
    } finally {
      this.inFlight.delete(run);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.task?.stop();
    await Promise.all([...this.inFlight]);
  }

  private async runScheduledTick(): Promise<void> {
    try {
      await this.runOnce();
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Scheduled outbox relay failed', error);
      } else {
        throw error;
      }
    }
  }

  private async executeRunOnce(): Promise<void> {
    const pending = await this.transactionManager.run((tx) =>
      this.outboxRepository.fetchPending(this.batchSize, tx),
    );

    for (const message of pending) {
      try {
        await this.eventBus.publish([toDeliveredEvent(message)]);
        await this.outboxRepository.markProcessed([message.id]);
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        await this.handleRelayFailure(message, error);
      }
    }

    await this.refreshGaugeMetrics();
  }

  private async handleRelayFailure(
    message: OutboxMessage,
    error: Error,
  ): Promise<void> {
    const errorMessage = truncateError(error);
    const attempts = await this.outboxRepository.recordFailure(
      message.id,
      errorMessage,
    );
    this.metrics.incrementOutboxRelayFailures(message.eventType);
    if (attempts >= this.maxRetries) {
      await this.outboxRepository.moveToDeadLetter(message.id, errorMessage);
      this.metrics.incrementOutboxDeadLetters(message.eventType);
      this.logger.error('Outbox message dead-lettered', error, {
        messageId: message.id,
        eventType: message.eventType,
        attempts,
      });
    } else {
      this.logger.error('Outbox relay failed', error, {
        messageId: message.id,
        attempts,
      });
    }
  }

  private async refreshGaugeMetrics(): Promise<void> {
    const [pendingCount, deadLetterCount, oldestPendingAgeSeconds] =
      await Promise.all([
        this.outboxRepository.countPending(),
        this.outboxRepository.countDeadLetters(),
        this.outboxRepository.oldestPendingAgeSeconds(),
      ]);

    this.metrics.setOutboxPendingMessages(pendingCount);
    this.metrics.setOutboxDeadLetterMessages(deadLetterCount);
    this.metrics.setOutboxOldestPendingAgeSeconds(oldestPendingAgeSeconds);
  }
}
