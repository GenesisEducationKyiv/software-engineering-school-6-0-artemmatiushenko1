import { z } from 'zod';
import 'dotenv/config';
import {
  GithubConfigSchema,
  getGithubConfigFromEnv,
} from './modules/github/config.js';
import {
  EmailConfigSchema,
  getEmailConfigFromEnv,
} from './modules/notification/config.js';
import {
  ScannerConfigSchema,
  getScannerConfigFromEnv,
} from './modules/scanner/config.js';

const AppConfigSchema = z.object({
  mode: z.enum(['development', 'production', 'test']),
  databaseUrl: z.url().default('postgres://user:pass@localhost:5432/db'),
  redisUrl: z.string().default('redis://localhost:6379'),
  appUrl: z.url().default('http://localhost:3000'),
  apiPrefix: z.string().default('/api'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  email: EmailConfigSchema,
  github: GithubConfigSchema,
  scanner: ScannerConfigSchema,
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const createConfig = () =>
  AppConfigSchema.parse({
    mode: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    appUrl: process.env.APP_URL,
    apiPrefix: process.env.API_PREFIX,
    port: process.env.PORT,
    host: process.env.HOST,
    github: getGithubConfigFromEnv(),
    email: getEmailConfigFromEnv(),
    scanner: getScannerConfigFromEnv(),
  });
