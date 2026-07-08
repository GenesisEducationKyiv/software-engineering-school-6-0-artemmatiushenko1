import type { Logger } from '../../../shared-kernel/logger.js';
import type {
  Scheduler,
  ScheduledTaskHandle,
} from '../../../platform/scheduler/scheduler.js';
import type { ScanUseCase } from '../application/scan.use-case.js';

export class ScanCron {
  private task?: ScheduledTaskHandle;

  constructor(
    private readonly cronExpression: string,
    private readonly scanUseCase: ScanUseCase,
    private readonly logger: Logger,
    private readonly scheduler: Scheduler,
  ) {}

  start(): void {
    this.task = this.scheduler.schedule(this.cronExpression, async () => {
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
