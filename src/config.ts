import { z } from 'zod';
import 'dotenv/config';

const ConfigSchema = z.object({
  mode: z.enum(['development', 'production', 'test', 'e2e']),
  databaseUrl: z.url().default('postgres://user:pass@localhost:5432/db'),
  redisUrl: z.string().default('redis://localhost:6379'),
  githubToken: z.string().optional(),
  email: z.object({
    user: z.email(),
    clientId: z.string().nonempty(),
    clientSecret: z.string().nonempty(),
    refreshToken: z.string().nonempty(),
  }),
  appUrl: z.url().default('http://localhost:3000'),
  apiPrefix: z.string().default('/api'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  scannerCron: z.string().default('*/10 * * * *'), // Default to every 10 minutes
  githubCacheTtl: z.coerce.number().default(600), // Default to 10 minutes in seconds
});

export type Config = z.infer<typeof ConfigSchema>;

export const config = ConfigSchema.parse({
  mode: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  githubToken: process.env.GITHUB_TOKEN,
  email: {
    user: process.env.GMAIL_USER_EMAIL,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  appUrl: process.env.APP_URL,
  apiPrefix: process.env.API_PREFIX,
  port: process.env.PORT,
  host: process.env.HOST,
  scannerCron: process.env.SCANNER_CRON,
  githubCacheTtl: process.env.GITHUB_CACHE_TTL,
});
