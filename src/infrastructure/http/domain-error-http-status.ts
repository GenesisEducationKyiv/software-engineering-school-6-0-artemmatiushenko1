import {
  domainErrorTypes,
  type DomainError,
  InvalidRepoFormatError,
  InvalidEmailError,
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
  TokenNotFoundError,
  InvalidTokenError,
  WrongTokenScopeError,
  IllegalStateTransitionError,
  TokenExpiredError,
  TokenAlreadyUsedError,
  InvalidReleaseTagError,
  GithubRateLimitError,
} from '../../domain/errors.js';

type DomainErrorConstructor = (typeof domainErrorTypes)[number];

const domainErrorHttpStatusEntries = [
  [InvalidEmailError, 400],
  [InvalidRepoFormatError, 400],
  [RepoNotFoundError, 404],
  [AlreadySubscribedError, 409],
  [SubscriptionNotFoundError, 404],
  [TokenNotFoundError, 404],
  [InvalidTokenError, 400],
  [WrongTokenScopeError, 400],
  [IllegalStateTransitionError, 400],
  [TokenExpiredError, 400],
  [TokenAlreadyUsedError, 400],
  [InvalidReleaseTagError, 400],
  [GithubRateLimitError, 429],
] as const satisfies ReadonlyArray<readonly [DomainErrorConstructor, number]>;

export type DomainErrorHttpResponse = {
  status: number;
  body: {
    error: string;
    code: string;
  };
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
  body: {
    error: error.message,
    code: error.code,
  },
});

export const mappedDomainErrorTypes = domainErrorHttpStatusEntries.map(
  ([ErrorClass]) => ErrorClass,
);
