import { describe, it, expect } from 'vitest';
import {
  domainErrorTypes,
  InvalidRepoFormatError,
  InvalidEmailError,
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
  TokenNotFoundError,
  InvalidTokenError,
  GithubRateLimitError,
} from '../../domain/errors.js';
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
    [new SubscriptionNotFoundError(1), 404],
    [new TokenNotFoundError(), 404],
    [new InvalidTokenError(), 400],
    [new GithubRateLimitError(), 429],
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
