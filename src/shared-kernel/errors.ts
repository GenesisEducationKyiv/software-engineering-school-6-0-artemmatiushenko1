export class InvalidEmailError extends Error {
  readonly code = 'INVALID_EMAIL' as const;

  constructor(email: string) {
    super(`Invalid email format: ${email}`);
    this.name = 'InvalidEmailError';
  }
}

export class InvalidRepoFormatError extends Error {
  readonly code = 'INVALID_REPO_FORMAT' as const;

  constructor(repoPath: string) {
    super(`Invalid repository format: ${repoPath}. Expected 'owner/repo'`);
    this.name = 'InvalidRepoFormatError';
  }
}

export class InvalidReleaseTagError extends Error {
  readonly code = 'INVALID_RELEASE_TAG' as const;

  constructor(tag: string) {
    super(`Invalid release tag: ${tag}`);
    this.name = 'InvalidReleaseTagError';
  }
}
