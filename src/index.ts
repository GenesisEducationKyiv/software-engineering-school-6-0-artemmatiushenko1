import Fastify from 'fastify';
import { App } from './app.js';
import { AppContainer } from './dependencies.js';
import { createConfig } from './config.js';
import { setupSwagger } from './swagger.js';
import { db } from './db/index.js';

const fastify = Fastify({
  logger: true,
});

const appConfig = createConfig();
const container = new AppContainer(appConfig, fastify.log, db);
const app = new App(appConfig, container.build(), fastify);

await setupSwagger(appConfig, fastify);

await app.start();

app.startScannerCron();
