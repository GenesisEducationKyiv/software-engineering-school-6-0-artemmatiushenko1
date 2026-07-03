import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/platform/db/schema.js';
import {
  MIGRATIONS_FOLDER,
  runDatabaseMigrations,
} from '../../src/platform/db/migrate.js';
import type { Database } from '../../src/platform/db/types.js';
import { DrizzleIdempotencyGuard } from '../../src/platform/idempotency-guard/drizzle-idempotency-guard.js';

describe('DrizzleIdempotencyGuard', () => {
  let db: Database;
  let idempotencyGuard: DrizzleIdempotencyGuard;

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
    idempotencyGuard = new DrizzleIdempotencyGuard(db);
  });

  afterEach(async () => {
    await db.delete(schema.processedDeliveries);
  });

  it('claims an id once', async () => {
    expect(await idempotencyGuard.claim('msg-1')).not.toBeNull();
    expect(await idempotencyGuard.claim('msg-1')).toBeNull();
  });

  it('allows reclaim after release', async () => {
    const claim = await idempotencyGuard.claim('msg-1');
    expect(claim).not.toBeNull();
    await claim!.release();
    expect(await idempotencyGuard.claim('msg-1')).not.toBeNull();
  });
});
