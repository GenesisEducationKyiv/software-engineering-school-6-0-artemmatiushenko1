import { describe, it, expect } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import {
  InvalidRepoFormatError,
  InvalidEmailError,
} from '../../shared-kernel/errors.js';
import { InvalidReleaseTagError } from '../../modules/scanner/domain/errors.js';
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
  domainErrorCodeMetadataKey,
  resolveDomainErrorGrpc,
  resolveDomainErrorGrpcStatus,
} from './domain-error-grpc.js';

describe('domain error grpc mapping', () => {
  it.each([
    [new InvalidRepoFormatError('owner'), grpc.status.INVALID_ARGUMENT],
    [new InvalidEmailError('bad'), grpc.status.INVALID_ARGUMENT],
    [new RepoNotFoundError('owner/repo'), grpc.status.NOT_FOUND],
    [
      new AlreadySubscribedError('a@b.com', 'owner/repo'),
      grpc.status.ALREADY_EXISTS,
    ],
    [new SubscriptionNotFoundError(), grpc.status.NOT_FOUND],
    [new InvalidTokenError('invalid'), grpc.status.INVALID_ARGUMENT],
    [
      new WrongTokenScopeError('confirm', 'unsubscribe'),
      grpc.status.INVALID_ARGUMENT,
    ],
    [
      new IllegalStateTransitionError('pending', 'confirmed'),
      grpc.status.INVALID_ARGUMENT,
    ],
    [new TokenExpiredError(), grpc.status.INVALID_ARGUMENT],
    [new TokenAlreadyUsedError(), grpc.status.INVALID_ARGUMENT],
    [new InvalidReleaseTagError(''), grpc.status.INVALID_ARGUMENT],
    [new GithubRateLimitError(), grpc.status.RESOURCE_EXHAUSTED],
    [new SubscriptionAlreadyConfirmedError(), grpc.status.ABORTED],
    [new SubscriptionAlreadyDeactivatedError(), grpc.status.ABORTED],
  ])('should map %s to gRPC status %i', (error, status) => {
    expect(resolveDomainErrorGrpcStatus(error)).toBe(status);
  });

  it('should attach domain error code metadata', () => {
    const error = new InvalidEmailError('bad@');
    const response = resolveDomainErrorGrpc(error);

    expect(response).toEqual({
      code: grpc.status.INVALID_ARGUMENT,
      details: error.message,
      metadata: expect.any(grpc.Metadata),
    });
    expect(response.metadata.get(domainErrorCodeMetadataKey)).toEqual([
      error.code,
    ]);
  });
});
