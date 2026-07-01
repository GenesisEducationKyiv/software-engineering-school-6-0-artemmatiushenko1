import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/platform/db/schema.js';
import {
  MIGRATIONS_FOLDER,
  runDatabaseMigrations,
} from '../../src/platform/db/migrate.js';
import type { Database } from '../../src/platform/db/types.js';
import { DrizzleTransactionManager } from '../../src/platform/db/drizzle-transaction-manager.js';
import { DrizzleOutboxRepository } from '../../src/platform/outbox/drizzle-outbox.repository.js';
import { toDomainEventEnvelope } from '../../src/platform/outbox/outbox-message.js';
import { CryptoIdGenerator } from '../../src/modules/subscription/infrastructure/crypto-id-generator.js';

describe('DrizzleOutboxRepository', () => {
  let db: Database;
  let outboxRepository: DrizzleOutboxRepository;
  let transactionManager: DrizzleTransactionManager;

  const sampleEvent = {
    type: 'SubscriptionRequested',
    aggregateId: 'sub-1',
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    payload: { email: 'user@example.com', repo: 'owner/repo' },
  };

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
    outboxRepository = new DrizzleOutboxRepository(db, new CryptoIdGenerator());
    transactionManager = new DrizzleTransactionManager(db);
  });

  afterEach(async () => {
    await db.delete(schema.outboxMessages);
  });

  const fetchPending = (limit: number) =>
    transactionManager.run((tx) => outboxRepository.fetchPending(limit, tx));

  it('saves events in a transaction and fetches them as pending', async () => {
    await transactionManager.run(async (tx) => {
      await outboxRepository.save([sampleEvent], tx);
    });

    const pending = await fetchPending(10);

    expect(pending).toHaveLength(1);
    expect(toDomainEventEnvelope(pending[0]!)).toEqual(sampleEvent);
  });

  it('rolls back outbox rows when the transaction fails', async () => {
    await expect(
      transactionManager.run(async (tx) => {
        await outboxRepository.save([sampleEvent], tx);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const pending = await fetchPending(10);
    expect(pending).toHaveLength(0);
  });

  it('marks fetched rows as processed', async () => {
    await transactionManager.run(async (tx) => {
      await outboxRepository.save([sampleEvent], tx);
    });

    const pending = await fetchPending(10);
    await outboxRepository.markProcessed(pending.map((message) => message.id));

    const afterMark = await fetchPending(10);
    expect(afterMark).toHaveLength(0);
  });
});
