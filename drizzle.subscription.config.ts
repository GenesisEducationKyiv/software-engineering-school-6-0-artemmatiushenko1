import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { createConfig } from './src/config.js';

const appConfig = createConfig();

export default defineConfig({
  out: './src/modules/subscription/infrastructure/db/migrations',
  schema: './src/modules/subscription/infrastructure/db/schema.ts',
  dialect: 'postgresql',
  schemaFilter: ['subscription'],
  dbCredentials: {
    url: appConfig.databaseUrl,
  },
});
