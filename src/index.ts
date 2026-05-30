import Fastify from 'fastify';
import { App } from './app.js';
import { AppContainer } from './dependencies.js';
import { createConfig } from './config.js';
import { db } from './db/index.js';
import { createFastifyLoggerOptions } from './infrastructure/logger/create-fastify-logger-options.js';

const appConfig = createConfig();

const fastify = Fastify({
  logger: createFastifyLoggerOptions(appConfig),
  disableRequestLogging: true,
});
const container = new AppContainer(appConfig, fastify.log, db);
const app = await App.create(appConfig, container.build(), fastify);

await app.start();

app.startScannerCron();
