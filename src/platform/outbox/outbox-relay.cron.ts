import cron, { type ScheduledTask } from 'node-cron';
import type { Logger } from '../../shared-kernel/logger.js';
import type { OutboxRelay } from './outbox-relay.js';

export class OutboxRelayCron {
  private task?: ScheduledTask;

  constructor(
    private readonly cronExpression: string,
    private readonly outboxRelay: OutboxRelay,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.task = cron.schedule(this.cronExpression, async () => {
      try {
        await this.outboxRelay.runOnce();
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error('Scheduled outbox relay failed', error);
        } else {
          throw error;
        }
      }
    });
  }

  async stop(): Promise<void> {
    await this.task?.stop();
  }
}
