import {
  DomainError,
  ErrorCategory,
} from '../../../shared-kernel/domain-error.js';

export class GithubRateLimitError extends DomainError {
  readonly code = 'GITHUB_RATE_LIMIT' as const;
  readonly category = ErrorCategory.RateLimited;

  constructor() {
    super('GitHub API rate limit exceeded');
  }
}
