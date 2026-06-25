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
import {
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
} from '../modules/subscription/application/errors.js';
import { GithubRateLimitError } from '../modules/github/domain/errors.js';

export {
  InvalidEmailError,
  InvalidRepoFormatError,
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
  InvalidReleaseTagError,
  IllegalStateTransitionError,
  WrongTokenScopeError,
  GithubRateLimitError,
};

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
