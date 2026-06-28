import { describe, it, expect } from 'vitest';
import {
  InvalidRepoFormatError,
  InvalidEmailError,
  InvalidReleaseTagError,
} from '../../shared-kernel/errors.js';
import {
  InvalidTokenError,
  WrongTokenScopeError,
  IllegalStateTransitionError,
  TokenExpiredError,
  TokenAlreadyUsedError,
  SubscriptionAlreadyConfirmedError,
  SubscriptionAlreadyDeactivatedError,
} from '../../modules/subscription/domain/errors.js';
import { GithubRateLimitError } from '../../modules/github/domain/errors.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
} from '../../modules/subscription/application/errors.js';
import {
  domainErrorRegistry,
  resolveDomainErrorHttpStatus,
  resolveDomainErrorHttpResponse,
  httpMappedDomainErrors,
} from './domain-error-registry.js';

describe('domain error registry', () => {
  it.each([
    [new InvalidRepoFormatError('owner'), 400],
    [new InvalidEmailError('bad'), 400],
    [new RepoNotFoundError('owner/repo'), 404],
    [new AlreadySubscribedError('a@b.com', 'owner/repo'), 409],
    [new SubscriptionNotFoundError(), 404],
    [new InvalidTokenError('invalid'), 400],
    [new WrongTokenScopeError('confirm', 'unsubscribe'), 400],
    [new IllegalStateTransitionError('pending', 'confirmed'), 400],
    [new TokenExpiredError(), 400],
    [new TokenAlreadyUsedError(), 400],
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

  it('should map every registered domain error to an HTTP status', () => {
    expect(httpMappedDomainErrors).toEqual([...domainErrorRegistry]);
  });
});
