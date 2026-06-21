import {
  InvalidEmailError,
  InvalidRepoFormatError,
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
  InvalidReleaseTagError,
  IllegalStateTransitionError,
  WrongTokenScopeError,
  SubscriptionAlreadyDeactivatedError,
  SubscriptionAlreadyConfirmedError,
} from '../modules/subscription/domain/errors.js';

export {
  InvalidEmailError,
  InvalidRepoFormatError,
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
  InvalidReleaseTagError,
  IllegalStateTransitionError,
  WrongTokenScopeError,
};

export class RepoNotFoundError extends Error {
  readonly code = 'REPO_NOT_FOUND' as const;

  constructor(repoPath: string) {
    super(`Repository not found: ${repoPath}`);
  }
}

export class AlreadySubscribedError extends Error {
  readonly code = 'ALREADY_SUBSCRIBED' as const;

  constructor(email: string, repoPath: string) {
    super(`${email} is already subscribed to ${repoPath}`);
  }
}

export class SubscriptionNotFoundError extends Error {
  readonly code = 'SUBSCRIPTION_NOT_FOUND' as const;

  constructor() {
    super(`Subscription not found`);
  }
}

export class GithubRateLimitError extends Error {
  readonly code = 'GITHUB_RATE_LIMIT' as const;

  constructor() {
    super('GitHub API rate limit exceeded');
  }
}

export const domainErrorTypes = [
  InvalidEmailError,
  InvalidRepoFormatError,
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
  InvalidTokenError,
  WrongTokenScopeError,
  IllegalStateTransitionError,
  TokenExpiredError,
  TokenAlreadyUsedError,
  InvalidReleaseTagError,
  GithubRateLimitError,
  SubscriptionAlreadyConfirmedError,
  SubscriptionAlreadyDeactivatedError,
] as const;

export type DomainError = InstanceType<(typeof domainErrorTypes)[number]>;

export type DomainErrorCodeType = DomainError['code'];

export const isDomainError = (error: unknown): error is DomainError =>
  domainErrorTypes.some((ErrorClass) => error instanceof ErrorClass);
