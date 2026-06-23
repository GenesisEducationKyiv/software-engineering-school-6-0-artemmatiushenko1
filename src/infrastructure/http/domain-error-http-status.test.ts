import { describe, it, expect } from 'vitest';
import {
  domainErrorTypes,
  InvalidRepoFormatError,
  InvalidEmailError,
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
} from '../../domain/errors.js';
import {
  SubscriptionAlreadyConfirmedError,
  SubscriptionAlreadyDeactivatedError,
} from '../../domain/subscription/errors.js';
import {
  resolveDomainErrorHttpStatus,
  resolveDomainErrorHttpResponse,
  mappedDomainErrorTypes,
} from './domain-error-http-status.js';

describe('resolveDomainErrorHttpStatus', () => {
  it.each([
    [new InvalidRepoFormatError('owner'), 400],
    [new InvalidEmailError('bad'), 400],
    [new RepoNotFoundError('owner/repo'), 404],
    [new AlreadySubscribedError('a@b.com', 'owner/repo'), 409],
    [new SubscriptionNotFoundError(), 404],
    [new InvalidTokenError(), 400],
    [new WrongTokenScopeError('confirm', 'unsubscribe'), 400],
    [new IllegalStateTransitionError('pending', 'confirmed'), 400],
    [new TokenExpiredError('token'), 400],
    [new TokenAlreadyUsedError('token'), 400],
    [new InvalidReleaseTagError(''), 400],
    [new GithubRateLimitError(), 429],
    [new SubscriptionAlreadyConfirmedError(), 409],
    [new SubscriptionAlreadyDeactivatedError(), 409],
  ])('should map %s to HTTP %i', (error, status) => {
    expect(resolveDomainErrorHttpStatus(error)).toBe(status);
  });

  it('should build a complete HTTP response for a domain error', () => {
    const error = new InvalidEmailError('bad@');

    expect(resolveDomainErrorHttpResponse(error)).toEqual({
      status: 400,
      body: {
        error: 'Invalid email format: bad@',
        code: error.code,
      },
    });
  });

  it('should map every domain error type', () => {
    expect(mappedDomainErrorTypes).toEqual([...domainErrorTypes]);
  });
});
