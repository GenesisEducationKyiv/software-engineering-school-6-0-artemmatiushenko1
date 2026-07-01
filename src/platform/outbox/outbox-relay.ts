import type { EventBus } from '../event-bus/event-bus.interface.js';
import type { Logger } from '../../shared-kernel/logger.js';
import type { TransactionManager } from '../../shared-kernel/transaction.js';
import type { OutboxRepository } from './outbox.repository.js';
import { toDomainEventEnvelope } from './outbox-message.js';

export class OutboxRelay {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly eventBus: EventBus,
    private readonly transactionManager: TransactionManager,
    private readonly logger: Logger,
    private readonly batchSize = 50,
  ) {}

  async runOnce(): Promise<void> {
    const pending = await this.transactionManager.run((tx) =>
      this.outboxRepository.fetchPending(this.batchSize, tx),
    );

    if (pending.length === 0) {
      return;
    }

    const envelopes = pending.map(toDomainEventEnvelope);

    try {
      await this.eventBus.publish(envelopes);
      await this.outboxRepository.markProcessed(
        pending.map((message) => message.id),
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Outbox relay failed', error);
      } else {
        throw error;
      }
    }
  }
}
