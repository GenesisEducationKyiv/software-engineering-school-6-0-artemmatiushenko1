import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { App } from './app.js';
import { AppContainer } from './dependencies.js';
import { createConfig } from './config.js';
import { db } from './platform/db/client.js';
import { createFastifyServerOptions } from './platform/fastify/create-fastify-server-options.js';
import { runAllDatabaseMigrations } from './platform/db/migrate.js';
import { FastifyLogger } from './platform/logger/fastify-logger.js';

const appConfig = createConfig();

const fastify = Fastify(createFastifyServerOptions(appConfig));
const logger = new FastifyLogger(fastify.log);
const redis = new Redis(appConfig.redisUrl, {
  maxRetriesPerRequest: null,
});

redis.on('error', (err) => {
  logger.error('Redis connection error', err);
});

const container = new AppContainer(appConfig, {
  db,
  logger,
  redis,
});
const deps = container.build();

deps.logger.info('Running database migrations...');
await runAllDatabaseMigrations(db);
deps.logger.info('Migrations completed successfully.');

const app = await App.create(appConfig, deps, fastify);

await app.start();

app.startScannerCron();
