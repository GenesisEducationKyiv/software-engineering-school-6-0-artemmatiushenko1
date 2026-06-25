import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { App } from '../../src/app.js';
import { AppContainer } from '../../src/dependencies.js';
import { mock } from 'vitest-mock-extended';
import { Redis } from 'ioredis';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/infrastructure/db/schema.js';
import {
  MIGRATIONS_FOLDER,
  runDatabaseMigrations,
} from '../../src/infrastructure/db/migrate.js';
import type { Database } from '../../src/infrastructure/db/types.js';
import { register } from 'prom-client';
import { TEST_APP_CONFIG } from './constants.js';
import { createFastifyServerOptions } from '../../src/infrastructure/fastify/create-fastify-server-options.js';

describe('Metrics Routes', () => {
  let app: App;
  let db: Database;

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  beforeEach(async () => {
    register.clear();

    const fastify = Fastify(createFastifyServerOptions(TEST_APP_CONFIG));
    const redisMock = mock<Redis>();

    const container = new AppContainer(TEST_APP_CONFIG, fastify.log, db);
    container.redis = redisMock;

    const deps = container.build();
    app = await App.create(TEST_APP_CONFIG, deps, fastify);
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

  it('should record HTTP RED metrics after a request', async () => {
    await app.fastify.inject({
      method: 'GET',
      url: '/health',
    });

    const metricsResponse = await app.fastify.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(metricsResponse.body).toContain(
      'http_server_requests_total{method="GET",route="/health",status_code="200"}',
    );
    expect(metricsResponse.body).toContain(
      'http_server_request_duration_seconds_bucket{le="0.005",method="GET",route="/health"}',
    );
  });
});
