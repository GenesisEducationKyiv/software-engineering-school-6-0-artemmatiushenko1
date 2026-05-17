import Fastify from 'fastify';
import { App } from './app.js';
import { createDependencies } from './dependencies.js';

const fastify = Fastify({
  logger: true,
});

const deps = createDependencies(fastify.log);
const app = new App(deps, fastify);
await app.start();
