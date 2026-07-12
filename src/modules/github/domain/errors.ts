export class GithubRateLimitError extends Error {
  readonly code = 'GITHUB_RATE_LIMIT' as const;

  constructor() {
    super('GitHub API rate limit exceeded');
  }
}
