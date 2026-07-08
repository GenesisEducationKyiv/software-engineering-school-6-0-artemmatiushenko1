import type { Scheduler, ScheduledTaskHandle } from './scheduler.js';

export class FakeScheduler implements Scheduler {
  readonly scheduledTasks: Array<() => Promise<void> | void> = [];
  stopCalls = 0;

  schedule(
    _cronExpression: string,
    task: () => Promise<void> | void,
  ): ScheduledTaskHandle {
    this.scheduledTasks.push(task);
    return {
      stop: async () => {
        this.stopCalls += 1;
        return Promise.resolve();
      },
    };
  }

  async invokeLatest(): Promise<void> {
    const task = this.scheduledTasks.at(-1);
    if (!task) {
      throw new Error('No scheduled task');
    }
    await task();
  }
}
