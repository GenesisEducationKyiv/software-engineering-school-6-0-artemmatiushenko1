import {
  DomainError,
  ErrorCategory,
} from '../../../shared-kernel/domain-error.js';

export class InvalidTokenError extends DomainError {
  readonly code = 'INVALID_TOKEN' as const;
  readonly category = ErrorCategory.Validation;

  constructor(reason: string) {
    super(`Invalid token: ${reason}`);
  }
}

export class TokenAlreadyUsedError extends DomainError {
  readonly code = 'TOKEN_ALREADY_USED' as const;
  readonly category = ErrorCategory.Validation;

  constructor() {
    super(`Token already used`);
  }
}

export class TokenExpiredError extends DomainError {
  readonly code = 'TOKEN_EXPIRED' as const;
  readonly category = ErrorCategory.Validation;

  constructor() {
    super(`Token is expired`);
  }
}

export class IllegalStateTransitionError extends DomainError {
  readonly code = 'ILLEGAL_STATE_TRANSITION' as const;
  readonly category = ErrorCategory.Validation;

  constructor(currentState: string, newState: string) {
    super(`Illegal state transition from ${currentState} to ${newState}`);
  }
}

export class WrongTokenScopeError extends DomainError {
  readonly code = 'WRONG_TOKEN_SCOPE' as const;
  readonly category = ErrorCategory.Validation;

  constructor(expectedScope: string, actualScope: string) {
    super(`Wrong token scope: expected ${expectedScope}, got ${actualScope}`);
  }
}

export class SubscriptionAlreadyConfirmedError extends DomainError {
  readonly code = 'SUBSCRIPTION_ALREADY_CONFIRMED' as const;
  readonly category = ErrorCategory.ConflictingState;

  constructor() {
    super('Subscription already confirmed');
  }
}

export class SubscriptionAlreadyDeactivatedError extends DomainError {
  readonly code = 'SUBSCRIPTION_ALREADY_DEACTIVATED' as const;
  readonly category = ErrorCategory.ConflictingState;

  constructor() {
    super('Subscription already deactivated');
  }
}
