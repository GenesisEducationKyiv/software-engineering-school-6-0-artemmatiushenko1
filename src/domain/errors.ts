import {
  InvalidEmailError,
  InvalidRepoFormatError,
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
  InvalidReleaseTagError,
  IllegalStateTransitionError,
  WrongTokenScopeError,
} from './subscription/errors.js';

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

  constructor(subscriptionId: number) {
    super(`Subscription not found: ${subscriptionId}`);
  }
}

export class TokenNotFoundError extends Error {
  readonly code = 'TOKEN_NOT_FOUND' as const;

  constructor(message: string = 'Token not found') {
    super(message);
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
  TokenNotFoundError,
  InvalidTokenError,
  WrongTokenScopeError,
  IllegalStateTransitionError,
  TokenExpiredError,
  TokenAlreadyUsedError,
  InvalidReleaseTagError,
  GithubRateLimitError,
] as const;

export type DomainError = InstanceType<(typeof domainErrorTypes)[number]>;

export type DomainErrorCodeType = DomainError['code'];

export const isDomainError = (error: unknown): error is DomainError =>
  domainErrorTypes.some((ErrorClass) => error instanceof ErrorClass);
