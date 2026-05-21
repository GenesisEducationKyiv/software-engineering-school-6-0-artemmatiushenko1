import Fastify from 'fastify';
import { App } from './app.js';
import { createDependencies } from './dependencies.js';
import { createConfig } from './config.js';
import { setupSwagger } from './swagger.js';

const fastify = Fastify({
  logger: true,
});

const appConfig = createConfig();
const deps = createDependencies(appConfig, fastify.log);
const app = new App(appConfig, deps, fastify);

await setupSwagger(appConfig, fastify);

await app.start();

app.startScannerCron();
