import Fastify from 'fastify';
import { Redis } from 'ioredis';
import { App } from './app.js';
import { AppContainer } from './dependencies.js';
import { createConfig } from './config.js';
import { db } from './platform/db/client.js';
import { createFastifyServerOptions } from './platform/fastify/create-fastify-server-options.js';
import { runAllDatabaseMigrations } from './platform/db/migrate.js';
import { FastifyLogger } from './platform/logger/fastify-logger.js';
import {
  bindGrpcServer,
  createGrpcServer,
} from './platform/grpc/create-grpc-server.js';
import { registerSubscriptionGrpc } from './modules/subscription/infrastructure/grpc/register-subscription-grpc.js';

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
container.wireEventSubscribers();
const deps = container.build();

deps.logger.info('Running database migrations...');
await runAllDatabaseMigrations(db);
deps.logger.info('Migrations completed successfully.');

const grpcServer = createGrpcServer();
registerSubscriptionGrpc(grpcServer, deps.subscription);

const grpcAddress = `${appConfig.grpcHost}:${appConfig.grpcPort}`;
const boundGrpcPort = await bindGrpcServer(grpcServer, grpcAddress);
deps.logger.info('gRPC server listening', {
  host: appConfig.grpcHost,
  port: boundGrpcPort,
});

const app = await App.create(appConfig, deps, fastify, grpcServer);

await app.start();

app.startScannerCron();
app.startOutboxRelayCron();
