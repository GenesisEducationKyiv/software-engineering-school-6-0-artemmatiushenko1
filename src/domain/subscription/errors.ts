import type { SubscriptionStatus } from './subscription.js';

export class InvalidEmailError extends Error {
  constructor(email: string) {
    super(`Invalid email format: ${email}`);
    this.name = 'InvalidEmailError';
  }
}

export class InvalidRepoFormatError extends Error {
  constructor(repoPath: string) {
    super(`Invalid repository format: ${repoPath}`);
    this.name = 'InvalidRepoFormatError';
  }
}

export class InvalidTokenError extends Error {
  constructor(reason: string) {
    super(`Invalid token: ${reason}`);
    this.name = 'InvalidTokenError';
  }
}

export class TokenAlreadyUsedError extends Error {
  constructor(token: string) {
    super(`Token ${token} already used`);
    this.name = 'TokenAlreadyUsedError';
  }
}

export class TokenExpiredError extends Error {
  constructor(token: string) {
    super(`Token ${token} expired`);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidReleaseTagError extends Error {
  constructor(tag: string) {
    super(`Invalid release tag: ${tag}`);
    this.name = 'InvalidReleaseTagError';
  }
}

export class IllegalStateTransitionError extends Error {
  constructor(currentState: SubscriptionStatus, newState: SubscriptionStatus) {
    super(`Illegal state transition from ${currentState} to ${newState}`);
    this.name = 'IllegalStateTransitionError';
  }
}

export class WrongTokenScopeError extends Error {
  constructor(expectedScope: string, actualScope: string) {
    super(`Wrong token scope: expected ${expectedScope}, got ${actualScope}`);
    this.name = 'WrongTokenScopeError';
  }
}
