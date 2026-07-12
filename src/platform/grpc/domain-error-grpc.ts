import * as grpc from '@grpc/grpc-js';
import {
  ErrorCategory,
  type DomainError,
} from '../../shared-kernel/domain-error.js';

export const domainErrorCodeMetadataKey = 'domain_error_code';

const categoryGrpcStatus: Record<ErrorCategory, grpc.status> = {
  [ErrorCategory.Validation]: grpc.status.INVALID_ARGUMENT,
  [ErrorCategory.NotFound]: grpc.status.NOT_FOUND,
  [ErrorCategory.AlreadyExists]: grpc.status.ALREADY_EXISTS,
  [ErrorCategory.ConflictingState]: grpc.status.ABORTED,
  [ErrorCategory.RateLimited]: grpc.status.RESOURCE_EXHAUSTED,
};

export type DomainErrorGrpcResponse = grpc.StatusObject;

export const resolveDomainErrorGrpcStatus = (error: DomainError): grpc.status =>
  categoryGrpcStatus[error.category];

export const resolveDomainErrorGrpc = (
  error: DomainError,
): DomainErrorGrpcResponse => {
  const metadata = new grpc.Metadata();
  metadata.set(domainErrorCodeMetadataKey, error.code);

  return {
    code: resolveDomainErrorGrpcStatus(error),
    details: error.message,
    metadata,
  };
};
