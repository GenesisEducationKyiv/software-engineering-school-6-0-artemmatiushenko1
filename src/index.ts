import Fastify from 'fastify';
import { App } from './app.js';
import { createDependencies } from './dependencies.js';
import { config } from './config.js';

const fastify = Fastify({
  logger: config.mode === 'test' ? false : true,
});

const deps = await createDependencies(fastify.log);
const app = new App(deps, fastify);
await app.start();
