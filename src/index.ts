import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { App } from './app.js';
import { AppContainer } from './dependencies.js';
import { createConfig } from './config.js';
import { db } from './platform/db/client.js';
import { createFastifyServerOptions } from './platform/fastify/create-fastify-server-options.js';
import {
  MIGRATIONS_FOLDER,
  runDatabaseMigrations,
} from './platform/db/migrate.js';
import { FastifyLogger } from './platform/logger/fastify-logger.js';
import { PrometheusMetrics } from './platform/metrics/prometheus-metrics.js';
import { SystemClock } from './modules/subscription/infrastructure/system-clock.js';
import { CryptoIdGenerator } from './modules/subscription/infrastructure/crypto-id-generator.js';
import { CryptoTokenGenerator } from './modules/subscription/infrastructure/crypto-token-generator.js';

const appConfig = createConfig();

const fastify = Fastify(createFastifyServerOptions(appConfig));
const logger = new FastifyLogger(fastify.log);
const metrics = new PrometheusMetrics();
const clock = new SystemClock();
const redis = new Redis(appConfig.redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  logger.error('Redis connection error', err);
});

const idGenerator = new CryptoIdGenerator();
const tokenGenerator = new CryptoTokenGenerator();

const container = new AppContainer(appConfig, {
  db,
  logger,
  redis,
  metrics,
  clock,
  idGenerator,
  tokenGenerator,
});
const deps = container.build();

deps.logger.info('Running database migrations...');
await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
deps.logger.info('Migrations completed successfully.');

const app = await App.create(appConfig, deps, fastify);

await app.start();

app.startScannerCron();
