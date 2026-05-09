export interface GithubRelease {
  tag: string;
  name: string | null;
  publishedAt: string | null;
}

export interface GithubClient {
  repositoryExists(owner: string, repo: string): Promise<boolean>;
  getLatestRelease(owner: string, repo: string): Promise<GithubRelease | null>;
}
