import cron from 'node-cron';
import type { Scheduler, ScheduledTaskHandle } from './scheduler.js';

export class NodeCronScheduler implements Scheduler {
  schedule(
    cronExpression: string,
    task: () => Promise<void> | void,
  ): ScheduledTaskHandle {
    const scheduled = cron.schedule(cronExpression, task);
    return {
      stop: async () => {
        await scheduled.stop();
      },
    };
  }
}
