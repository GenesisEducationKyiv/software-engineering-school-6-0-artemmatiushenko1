import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { createConfig } from './src/config.js';

const appConfig = createConfig();

export default defineConfig({
  out: './src/modules/notification/infrastructure/db/migrations',
  schema: './src/modules/notification/infrastructure/db/schema.ts',
  dialect: 'postgresql',
  schemaFilter: ['notification'],
  dbCredentials: {
    url: appConfig.databaseUrl,
  },
});
