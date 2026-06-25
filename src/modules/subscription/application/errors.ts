export class RepoNotFoundError extends Error {
  readonly code = 'REPO_NOT_FOUND' as const;

  constructor(repoPath: string) {
    super(`Repository not found: ${repoPath}`);
  }
}

export class AlreadySubscribedError extends Error {
  readonly code = 'ALREADY_SUBSCRIBED' as const;

  constructor(email: string, repoPath: string) {
    super(`${email} is already subscribed to ${repoPath}`);
  }
}

export class SubscriptionNotFoundError extends Error {
  readonly code = 'SUBSCRIPTION_NOT_FOUND' as const;

  constructor() {
    super(`Subscription not found`);
  }
}
