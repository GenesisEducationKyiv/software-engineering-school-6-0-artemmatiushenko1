import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { App } from '../../src/app.js';
import { createDependencies } from '../../src/dependencies.js';
import { mock } from 'vitest-mock-extended';
import { Redis } from 'ioredis';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/db/schema.js';
import type { Database } from '../../src/db/index.js';
import { register } from 'prom-client';
import { TEST_APP_CONFIG } from './app-config.mock.js';

describe('Metrics Routes', () => {
  let app: App;

  beforeEach(async () => {
    register.clear();
    const pgLiteClient = new PGlite();
    const pgDb = drizzle(pgLiteClient, { schema }) as unknown as Database;
    const redisMock = mock<Redis>();

    const fastify = Fastify({ logger: true });

    const deps = createDependencies(TEST_APP_CONFIG, fastify.log, {
      db: pgDb,
      redis: redisMock,
    });
    app = new App(TEST_APP_CONFIG, deps, fastify);
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
