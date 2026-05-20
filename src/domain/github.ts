import z from 'zod';

export const GitHubReleaseSchema = z.object({
  tag: z.string(),
  name: z.string().nullable(),
  publishedAt: z.string().nullable(),
});

export type GithubRelease = z.infer<typeof GitHubReleaseSchema>;

export interface GithubClient {
  repositoryExists(owner: string, repo: string): Promise<boolean>;
  getLatestRelease(owner: string, repo: string): Promise<GithubRelease | null>;
}
