import {
  DomainError,
  ErrorCategory,
} from '../../../shared-kernel/domain-error.js';

export class InvalidReleaseTagError extends DomainError {
  readonly code = 'INVALID_RELEASE_TAG' as const;
  readonly category = ErrorCategory.Validation;

  constructor(tag: string) {
    super(`Invalid release tag: ${tag}`);
  }
}

export class EmptyMonitoredRepoError extends Error {
  readonly code = 'EMPTY_MONITORED_REPO' as const;

  constructor(repo: string) {
    super(`MonitoredRepo must have at least one watcher: ${repo}`);
    this.name = 'EmptyMonitoredRepoError';
  }
}
