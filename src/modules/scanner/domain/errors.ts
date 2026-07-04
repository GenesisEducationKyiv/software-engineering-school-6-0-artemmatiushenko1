export class InvalidReleaseTagError extends Error {
  readonly code = 'INVALID_RELEASE_TAG' as const;

  constructor(tag: string) {
    super(`Invalid release tag: ${tag}`);
    this.name = 'InvalidReleaseTagError';
  }
}

export class EmptyMonitoredRepoError extends Error {
  readonly code = 'EMPTY_MONITORED_REPO' as const;

  constructor(repo: string) {
    super(`MonitoredRepo must have at least one watcher: ${repo}`);
    this.name = 'EmptyMonitoredRepoError';
  }
}
