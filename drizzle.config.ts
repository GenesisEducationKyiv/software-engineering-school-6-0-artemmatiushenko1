import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { createConfig } from './src/config.js';

const appConfig = createConfig();

export default defineConfig({
  out: './drizzle',
  schema: './src/platform/db/schema.ts',
  dialect: 'postgresql',
  schemaFilter: ['subscription', 'scanner', 'notification'],
  dbCredentials: {
    url: appConfig.databaseUrl,
  },
});
