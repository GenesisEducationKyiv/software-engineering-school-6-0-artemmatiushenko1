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
} from '../../modules/subscription/domain/errors.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
} from '../../modules/subscription/application/errors.js';
import { GithubRateLimitError } from '../../modules/github/domain/errors.js';
import {
  CommonErrorResponseDtoSchema,
  type CommonErrorResponseDto,
} from './response.dto.js';

export const domainErrorRegistry = [
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

export type DomainError = InstanceType<(typeof domainErrorRegistry)[number]>;

export type DomainErrorCodeType = DomainError['code'];

export const isDomainError = (error: unknown): error is DomainError =>
  domainErrorRegistry.some((ErrorClass) => error instanceof ErrorClass);

type DomainErrorConstructor = (typeof domainErrorRegistry)[number];

const domainErrorHttpStatusEntries = [
  [InvalidEmailError, 400],
  [InvalidRepoFormatError, 400],
  [RepoNotFoundError, 404],
  [AlreadySubscribedError, 409],
  [SubscriptionNotFoundError, 404],
  [InvalidTokenError, 400],
  [WrongTokenScopeError, 400],
  [IllegalStateTransitionError, 400],
  [TokenExpiredError, 400],
  [TokenAlreadyUsedError, 400],
  [InvalidReleaseTagError, 400],
  [GithubRateLimitError, 429],
  [SubscriptionAlreadyConfirmedError, 409],
  [SubscriptionAlreadyDeactivatedError, 409],
] as const satisfies ReadonlyArray<readonly [DomainErrorConstructor, number]>;

export type DomainErrorHttpResponse = {
  status: number;
  body: CommonErrorResponseDto;
};

export const resolveDomainErrorHttpStatus = (error: DomainError): number => {
  for (const [ErrorClass, status] of domainErrorHttpStatusEntries) {
    if (error instanceof ErrorClass) {
      return status;
    }
  }

  throw new Error(`Unmapped domain error: ${error.code}`);
};

export const resolveDomainErrorHttpResponse = (
  error: DomainError,
): DomainErrorHttpResponse => ({
  status: resolveDomainErrorHttpStatus(error),
  body: CommonErrorResponseDtoSchema.parse({
    error: error.message,
    code: error.code,
  }),
});

export const httpMappedDomainErrors = domainErrorHttpStatusEntries.map(
  ([ErrorClass]) => ErrorClass,
);
