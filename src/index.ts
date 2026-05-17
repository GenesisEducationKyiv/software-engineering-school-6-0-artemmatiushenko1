import Fastify from 'fastify';
import { App } from './app.js';
import { createDependencies } from './dependencies.js';

const fastify = Fastify({
  logger: true,
});

const deps = await createDependencies(fastify.log);
const app = new App(deps, fastify);
await app.start();
