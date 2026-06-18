import type { SubscriptionStatus } from './subscription.js';

export class InvalidEmailError extends Error {
  readonly code = 'INVALID_EMAIL' as const;

  constructor(email: string) {
    super(`Invalid email format: ${email}`);
    this.name = 'InvalidEmailError';
  }
}

export class InvalidRepoFormatError extends Error {
  readonly code = 'INVALID_REPO_FORMAT' as const;

  constructor(repoPath: string) {
    super(`Invalid repository format: ${repoPath}. Expected 'owner/repo'`);
    this.name = 'InvalidRepoFormatError';
  }
}

export class InvalidTokenError extends Error {
  readonly code = 'INVALID_TOKEN' as const;

  constructor(reason: string = 'Invalid token') {
    super(
      reason.startsWith('Invalid token') ? reason : `Invalid token: ${reason}`,
    );
    this.name = 'InvalidTokenError';
  }
}

export class TokenAlreadyUsedError extends Error {
  readonly code = 'TOKEN_ALREADY_USED' as const;

  constructor(token: string) {
    super(`Token ${token} already used`);
    this.name = 'TokenAlreadyUsedError';
  }
}

export class TokenExpiredError extends Error {
  readonly code = 'TOKEN_EXPIRED' as const;

  constructor(token: string) {
    super(`Token ${token} expired`);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidReleaseTagError extends Error {
  readonly code = 'INVALID_RELEASE_TAG' as const;

  constructor(tag: string) {
    super(`Invalid release tag: ${tag}`);
    this.name = 'InvalidReleaseTagError';
  }
}

export class IllegalStateTransitionError extends Error {
  readonly code = 'ILLEGAL_STATE_TRANSITION' as const;

  constructor(currentState: SubscriptionStatus, newState: SubscriptionStatus) {
    super(`Illegal state transition from ${currentState} to ${newState}`);
    this.name = 'IllegalStateTransitionError';
  }
}

export class WrongTokenScopeError extends Error {
  readonly code = 'WRONG_TOKEN_SCOPE' as const;

  constructor(expectedScope: string, actualScope: string) {
    super(`Wrong token scope: expected ${expectedScope}, got ${actualScope}`);
    this.name = 'WrongTokenScopeError';
  }
}
