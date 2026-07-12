import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/platform/db/schema.js';
import { runAllDatabaseMigrations } from '../../src/platform/db/migrate.js';
import type { Database } from '../../src/platform/db/types.js';
import { DrizzleIdempotencyGuard } from '../../src/platform/idempotency-guard/drizzle-idempotency-guard.js';

describe('DrizzleIdempotencyGuard', () => {
  let db: Database;
  let idempotencyGuard: DrizzleIdempotencyGuard;

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await runAllDatabaseMigrations(db);
    idempotencyGuard = new DrizzleIdempotencyGuard(db);
  });

  afterEach(async () => {
    await db.delete(schema.processedDeliveries);
  });

  it('tracks processed keys', async () => {
    expect(await idempotencyGuard.isProcessed('msg-1')).toBe(false);
    await idempotencyGuard.markProcessed('msg-1');
    expect(await idempotencyGuard.isProcessed('msg-1')).toBe(true);
  });

  it('markProcessed is idempotent', async () => {
    await idempotencyGuard.markProcessed('msg-1');
    await idempotencyGuard.markProcessed('msg-1');
    expect(await idempotencyGuard.isProcessed('msg-1')).toBe(true);
  });
});
