import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { createConfig } from './src/config.js';

const appConfig = createConfig();

export default defineConfig({
  out: './src/platform/db/migrations',
  schema: './src/platform/db/platform-schema.ts',
  dialect: 'postgresql',
  schemaFilter: ['platform'],
  dbCredentials: {
    url: appConfig.databaseUrl,
  },
});
