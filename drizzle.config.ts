import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { createConfig } from './src/config.js';

const appConfig = createConfig();

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: appConfig.databaseUrl,
  },
});
