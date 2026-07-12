import { z } from 'zod';

export const GithubConfigSchema = z.object({
  githubToken: z.string().optional(),
  githubCacheTtl: z.coerce.number().default(600), // Default to 10 minutes in seconds
  githubApiBaseUrl: z.string(),
});

export type GithubConfig = z.infer<typeof GithubConfigSchema>;

export const getGithubConfigFromEnv = () => ({
  githubToken: process.env.GITHUB_TOKEN,
  githubCacheTtl: process.env.GITHUB_CACHE_TTL,
  githubApiBaseUrl: process.env.GITHUB_API_URL,
});
