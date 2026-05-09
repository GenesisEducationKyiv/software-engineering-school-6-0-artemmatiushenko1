export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InvalidRepoFormatError extends DomainError {
  constructor(repoPath: string) {
    super(
      `Invalid repository format: ${repoPath}. Expected 'owner/repo'`,
      'INVALID_REPO_FORMAT',
      400,
    );
  }
}

export class InvalidEmailError extends DomainError {
  constructor(email: string) {
    super(`Invalid email format: ${email}`, 'INVALID_EMAIL', 400);
  }
}

export class RepoNotFoundError extends DomainError {
  constructor(repoPath: string) {
    super(`Repository not found: ${repoPath}`, 'REPO_NOT_FOUND', 404);
  }
}

export class AlreadySubscribedError extends DomainError {
  constructor(email: string, repoPath: string) {
    super(
      `${email} is already subscribed to ${repoPath}`,
      'ALREADY_SUBSCRIBED',
      409,
    );
  }
}

export class TokenNotFoundError extends DomainError {
  constructor() {
    super('Token not found', 'TOKEN_NOT_FOUND', 404);
  }
}

export class InvalidTokenError extends DomainError {
  constructor(reason: string = 'Invalid token') {
    super(reason, 'INVALID_TOKEN', 400);
  }
}

export class GithubRateLimitError extends DomainError {
  constructor() {
    super('GitHub API rate limit exceeded', 'GITHUB_RATE_LIMIT', 429);
  }
}
