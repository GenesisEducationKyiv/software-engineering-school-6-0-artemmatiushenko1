import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { App } from '../app.js';
import { createDependencies } from '../dependencies.js';
import { mock } from 'vitest-mock-extended';
import { Redis } from 'ioredis';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.js';
import type { Database } from '../db/index.js';
import { register } from 'prom-client';

describe('Metrics Routes', () => {
  let app: App;

  beforeEach(async () => {
    register.clear();
    const pgLiteClient = new PGlite();
    const pgDb = drizzle(pgLiteClient, { schema }) as unknown as Database;
    const redisMock = mock<Redis>();

    const fastify = Fastify({ logger: false });
    const deps = createDependencies(fastify.log, {
      db: pgDb,
      redis: redisMock,
    });
    app = new App(deps, fastify);
    await app.setup();
  });

  it('should return metrics on /metrics', async () => {
    const response = await app.fastify.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toBeDefined();
  });
});
