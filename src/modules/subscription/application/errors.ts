import {
  DomainError,
  ErrorCategory,
} from '../../../shared-kernel/domain-error.js';

export class RepoNotFoundError extends DomainError {
  readonly code = 'REPO_NOT_FOUND' as const;
  readonly category = ErrorCategory.NotFound;

  constructor(repoPath: string) {
    super(`Repository not found: ${repoPath}`);
  }
}

export class AlreadySubscribedError extends DomainError {
  readonly code = 'ALREADY_SUBSCRIBED' as const;
  readonly category = ErrorCategory.AlreadyExists;

  constructor(email: string, repoPath: string) {
    super(`${email} is already subscribed to ${repoPath}`);
  }
}

export class SubscriptionNotFoundError extends DomainError {
  readonly code = 'SUBSCRIPTION_NOT_FOUND' as const;
  readonly category = ErrorCategory.NotFound;

  constructor() {
    super(`Subscription not found`);
  }
}
