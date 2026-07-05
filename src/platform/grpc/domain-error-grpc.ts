import * as grpc from '@grpc/grpc-js';
import {
  InvalidEmailError,
  InvalidRepoFormatError,
} from '../../shared-kernel/errors.js';
import { InvalidReleaseTagError } from '../../modules/scanner/domain/errors.js';
import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  TokenExpiredError,
  IllegalStateTransitionError,
  WrongTokenScopeError,
  SubscriptionAlreadyDeactivatedError,
  SubscriptionAlreadyConfirmedError,
} from '../../modules/subscription/domain/errors.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
} from '../../modules/subscription/application/errors.js';
import { GithubRateLimitError } from '../../modules/github/domain/errors.js';
import {
  domainErrorRegistry,
  isDomainError,
  type DomainError,
} from '../http/domain-error-registry.js';

export { isDomainError };

export const domainErrorCodeMetadataKey = 'domain_error_code';

type DomainErrorConstructor = (typeof domainErrorRegistry)[number];

const domainErrorGrpcStatusEntries = [
  [InvalidEmailError, grpc.status.INVALID_ARGUMENT],
  [InvalidRepoFormatError, grpc.status.INVALID_ARGUMENT],
  [RepoNotFoundError, grpc.status.NOT_FOUND],
  [AlreadySubscribedError, grpc.status.ALREADY_EXISTS],
  [SubscriptionNotFoundError, grpc.status.NOT_FOUND],
  [InvalidTokenError, grpc.status.INVALID_ARGUMENT],
  [WrongTokenScopeError, grpc.status.INVALID_ARGUMENT],
  [IllegalStateTransitionError, grpc.status.INVALID_ARGUMENT],
  [TokenExpiredError, grpc.status.INVALID_ARGUMENT],
  [TokenAlreadyUsedError, grpc.status.INVALID_ARGUMENT],
  [InvalidReleaseTagError, grpc.status.INVALID_ARGUMENT],
  [GithubRateLimitError, grpc.status.RESOURCE_EXHAUSTED],
  [SubscriptionAlreadyConfirmedError, grpc.status.FAILED_PRECONDITION],
  [SubscriptionAlreadyDeactivatedError, grpc.status.FAILED_PRECONDITION],
] as const satisfies ReadonlyArray<
  readonly [DomainErrorConstructor, grpc.status]
>;

export type DomainErrorGrpcResponse = {
  code: grpc.status;
  message: string;
  metadata: grpc.Metadata;
};

export const resolveDomainErrorGrpcStatus = (
  error: DomainError,
): grpc.status => {
  for (const [ErrorClass, status] of domainErrorGrpcStatusEntries) {
    if (error instanceof ErrorClass) {
      return status;
    }
  }

  throw new Error(`Unmapped domain error: ${error.code}`);
};

export const resolveDomainErrorGrpc = (
  error: DomainError,
): DomainErrorGrpcResponse => {
  const metadata = new grpc.Metadata();
  metadata.set(domainErrorCodeMetadataKey, error.code);

  return {
    code: resolveDomainErrorGrpcStatus(error),
    message: error.message,
    metadata,
  };
};

export const grpcMappedDomainErrors = domainErrorGrpcStatusEntries.map(
  ([ErrorClass]) => ErrorClass,
);
