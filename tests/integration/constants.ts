import type { AppConfig } from '../../src/config.js';

export const TEST_APP_CONFIG: AppConfig = {
  mode: 'test',
  databaseUrl: '',
  redisUrl: '',
  port: 3000,
  host: 'localhost',
  appUrl: 'http://localhost:3000',
  apiPrefix: '/api',
  githubToken: undefined,
  scannerCron: '',
  githubCacheTtl: 0,
  githubApiBaseUrl: '',
  email: {
    type: 'smtp',
    host: 'localhost',
    port: 1025,
    from: 'test@example.com',
    secure: true,
  },
};
