import { InvalidRepoFormatError } from './errors.js';

export class RepoPath {
  private constructor(
    public readonly owner: string,
    public readonly repo: string,
  ) {
    Object.freeze(this);
  }

  static fromString(repoPath: string): RepoPath {
    const [owner, repo] = repoPath.split('/');
    if (!owner || !repo) {
      throw new InvalidRepoFormatError(repoPath);
    }

    return new RepoPath(owner, repo);
  }

  toString(): string {
    return `${this.owner}/${this.repo}`;
  }
}
