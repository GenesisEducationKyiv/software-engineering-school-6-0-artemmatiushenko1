import { z } from 'zod';
import 'dotenv/config';

const EmailConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('smtp'),
    host: z.string(),
    port: z.coerce.number(),
    user: z.string().optional(),
    pass: z.string().optional(),
    secure: z.coerce.boolean().default(false),
    from: z.string(),
  }),
  z.object({
    type: z.literal('gmail'),
    user: z.email(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    refreshToken: z.string().min(1),
  }),
]);

const AppConfigSchema = z.object({
  mode: z.enum(['development', 'production', 'test']),
  databaseUrl: z.url().default('postgres://user:pass@localhost:5432/db'),
  redisUrl: z.string().default('redis://localhost:6379'),
  githubToken: z.string().optional(),
  email: EmailConfigSchema,
  appUrl: z.url().default('http://localhost:3000'),
  apiPrefix: z.string().default('/api'),
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  scannerCron: z.string().default('*/10 * * * *'), // Default to every 10 minutes
  outboxRelayCron: z.string().default('*/5 * * * * *'), // Default to every 5 seconds
  githubCacheTtl: z.coerce.number().default(600), // Default to 10 minutes in seconds
  githubApiBaseUrl: z.string(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;

const getEmailConfig = () => {
  const type = process.env.EMAIL_TYPE;

  switch (type) {
    case 'smtp':
      return {
        type: 'smtp',
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        secure: process.env.SMTP_SECURE === 'true',
        from: process.env.SMTP_FROM,
      };
    case 'gmail':
      return {
        type: 'gmail',
        user: process.env.GMAIL_USER_EMAIL,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      };
    default:
      throw Error('Unknown email config type detected!');
  }
};

export const createConfig = () =>
  AppConfigSchema.parse({
    mode: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    githubToken: process.env.GITHUB_TOKEN,
    email: getEmailConfig(),
    appUrl: process.env.APP_URL,
    apiPrefix: process.env.API_PREFIX,
    port: process.env.PORT,
    host: process.env.HOST,
    scannerCron: process.env.SCANNER_CRON,
    outboxRelayCron: process.env.OUTBOX_RELAY_CRON,
    githubCacheTtl: process.env.GITHUB_CACHE_TTL,
    githubApiBaseUrl: process.env.GITHUB_API_URL,
  });
