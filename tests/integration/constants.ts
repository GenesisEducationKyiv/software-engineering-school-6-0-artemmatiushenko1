import type { AppConfig } from '../../src/config.js';

export const TEST_APP_CONFIG: AppConfig = {
  mode: 'test',
  databaseUrl: '',
  redisUrl: '',
  port: 3000,
  host: 'localhost',
  grpcPort: 50051,
  grpcHost: 'localhost',
  appUrl: 'http://localhost:3000',
  apiPrefix: '/api',
  outboxRelayCron: '*/1 * * * * *',
  outboxMaxRetries: 10,
  scanner: {
    cronExpression: '',
  },
  github: {
    githubCacheTtl: 0,
    githubApiBaseUrl: '',
  },
  email: {
    type: 'smtp',
    host: 'localhost',
    port: 1025,
    from: 'test@example.com',
    secure: true,
  },
};
