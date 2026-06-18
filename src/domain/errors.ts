export class InvalidRepoFormatError extends Error {
  readonly code = 'INVALID_REPO_FORMAT' as const;

  constructor(repoPath: string) {
    super(`Invalid repository format: ${repoPath}. Expected 'owner/repo'`);
  }
}

export class InvalidEmailError extends Error {
  readonly code = 'INVALID_EMAIL' as const;

  constructor(email: string) {
    super(`Invalid email format: ${email}`);
  }
}

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

export class InvalidTokenError extends Error {
  readonly code = 'INVALID_TOKEN' as const;

  constructor(reason: string = 'Invalid token') {
    super(reason);
  }
}

export class GithubRateLimitError extends Error {
  readonly code = 'GITHUB_RATE_LIMIT' as const;

  constructor() {
    super('GitHub API rate limit exceeded');
  }
}

export const domainErrorTypes = [
  InvalidRepoFormatError,
  InvalidEmailError,
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
  TokenNotFoundError,
  InvalidTokenError,
  GithubRateLimitError,
] as const;

export type DomainError = InstanceType<(typeof domainErrorTypes)[number]>;

export type DomainErrorCodeType = DomainError['code'];

export const isDomainError = (error: unknown): error is DomainError =>
  domainErrorTypes.some((ErrorClass) => error instanceof ErrorClass);
