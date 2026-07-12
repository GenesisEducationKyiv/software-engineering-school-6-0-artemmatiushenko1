import {
  ErrorCategory,
  type DomainError,
} from '../../shared-kernel/domain-error.js';
import {
  CommonErrorResponseDtoSchema,
  type CommonErrorResponseDto,
} from './response.dto.js';

const categoryHttpStatus: Record<ErrorCategory, number> = {
  [ErrorCategory.Validation]: 400,
  [ErrorCategory.NotFound]: 404,
  [ErrorCategory.AlreadyExists]: 409,
  [ErrorCategory.ConflictingState]: 409,
  [ErrorCategory.RateLimited]: 429,
};

export type DomainErrorHttpResponse = {
  status: number;
  body: CommonErrorResponseDto;
};

export const resolveDomainErrorHttpStatus = (error: DomainError): number =>
  categoryHttpStatus[error.category];

export const resolveDomainErrorHttpResponse = (
  error: DomainError,
): DomainErrorHttpResponse => ({
  status: resolveDomainErrorHttpStatus(error),
  body: CommonErrorResponseDtoSchema.parse({
    error: error.message,
    code: error.code,
  }),
});
