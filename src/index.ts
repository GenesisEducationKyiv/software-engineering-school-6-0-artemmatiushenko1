import Fastify from 'fastify';
import { App } from './app.js';
import { AppContainer } from './dependencies.js';
import { createConfig } from './config.js';
import { db } from './db/index.js';

const fastify = Fastify({
  logger: true,
});

const appConfig = createConfig();
const container = new AppContainer(appConfig, fastify.log, db);
const app = await App.create(appConfig, container.build(), fastify);

await app.start();

app.startScannerCron();
