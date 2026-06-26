import cron, { type ScheduledTask } from 'node-cron';
import type { Logger } from '../../../shared-kernel/logger.js';
import type { ScanUseCase } from '../application/scan.use-case.js';

export class ScanCron {
  private task?: ScheduledTask;

  constructor(
    private readonly cronExpression: string,
    private readonly scanUseCase: ScanUseCase,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.task = cron.schedule(this.cronExpression, async () => {
      this.logger.info('Starting scheduled scan');
      try {
        await this.scanUseCase.execute();
        this.logger.info('Scheduled scan completed');
      } catch (error) {
        if (error instanceof Error) {
          this.logger.error('Scheduled scan failed', error);
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
