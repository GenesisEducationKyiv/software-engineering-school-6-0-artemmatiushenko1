import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/platform/db/schema.js';
import {
  MIGRATIONS_FOLDER,
  runDatabaseMigrations,
} from '../../src/platform/db/migrate.js';
import type { Database } from '../../src/platform/db/types.js';
import { DrizzleDeliveryDedup } from '../../src/platform/delivery-dedup/drizzle-delivery-dedup.js';

describe('DrizzleDeliveryDedup', () => {
  let db: Database;
  let deliveryDedup: DrizzleDeliveryDedup;

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
    deliveryDedup = new DrizzleDeliveryDedup(db);
  });

  afterEach(async () => {
    await db.delete(schema.processedDeliveries);
  });

  it('claims a delivery id once', async () => {
    expect(await deliveryDedup.claim('msg-1')).not.toBeNull();
    expect(await deliveryDedup.claim('msg-1')).toBeNull();
  });

  it('allows reclaim after release', async () => {
    const claim = await deliveryDedup.claim('msg-1');
    expect(claim).not.toBeNull();
    await claim!.release();
    expect(await deliveryDedup.claim('msg-1')).not.toBeNull();
  });

  it('returns an open claim when id is absent', async () => {
    expect(await deliveryDedup.claim(undefined)).not.toBeNull();
  });
});
