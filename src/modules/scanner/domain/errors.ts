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

export class RepoWatcherNotFoundError extends Error {
  readonly code = 'REPO_WATCHER_NOT_FOUND' as const;

  constructor(subscriptionId: string, repo: string) {
    super(`RepoWatcher not found: ${subscriptionId} in ${repo}`);
    this.name = 'RepoWatcherNotFoundError';
  }
}
