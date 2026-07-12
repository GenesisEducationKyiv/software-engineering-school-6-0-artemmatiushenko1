import z from 'zod';

export const GitHubReleaseSchema = z.object({
  tag: z.string(),
  name: z.string().nullable(),
  publishedAt: z.string().nullable(),
});
