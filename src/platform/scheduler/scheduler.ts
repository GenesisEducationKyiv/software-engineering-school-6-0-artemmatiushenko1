export interface ScheduledTaskHandle {
  stop(): Promise<void>;
}

export interface Scheduler {
  schedule(
    cronExpression: string,
    task: () => Promise<void> | void,
  ): ScheduledTaskHandle;
}
