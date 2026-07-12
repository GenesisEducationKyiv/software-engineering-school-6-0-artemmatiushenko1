import { DomainError, ErrorCategory } from './domain-error.js';

export class InvalidEmailError extends DomainError {
  readonly code = 'INVALID_EMAIL' as const;
  readonly category = ErrorCategory.Validation;

  constructor(email: string) {
    super(`Invalid email format: ${email}`);
  }
}

export class InvalidRepoFormatError extends DomainError {
  readonly code = 'INVALID_REPO_FORMAT' as const;
  readonly category = ErrorCategory.Validation;

  constructor(repoPath: string) {
    super(`Invalid repository format: ${repoPath}. Expected 'owner/repo'`);
  }
}
