import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { createConfig } from './src/config.js';

const appConfig = createConfig();

export default defineConfig({
  out: './src/modules/scanner/infrastructure/db/migrations',
  schema: './src/modules/scanner/infrastructure/db/schema.ts',
  dialect: 'postgresql',
  schemaFilter: ['scanner'],
  dbCredentials: {
    url: appConfig.databaseUrl,
  },
});
