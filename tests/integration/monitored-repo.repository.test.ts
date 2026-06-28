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
import { MonitoredRepoRepository } from '../../src/modules/scanner/infrastructure/monitored-repo.repository.js';
import {
  Email,
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../../src/modules/scanner/domain/index.js';

describe('MonitoredRepoRepository', () => {
  let db: Database;
  let repository: MonitoredRepoRepository;
  let transactionManager: DrizzleTransactionManager;

  const save = async (monitoredRepo: MonitoredRepo) => {
    await transactionManager.run(async (tx) => {
      await repository.save(monitoredRepo, tx);
    });
  };

  const createWatcher = (
    subscriptionId: string,
    email: string,
    lastNotifiedTag: string | null = 'v1.0.0',
  ) =>
    RepoWatcher.create({
      subscriptionId,
      email: Email.fromString(email),
      unsubscribeToken: `unsub-${subscriptionId}`,
      lastNotifiedTag: lastNotifiedTag
        ? ReleaseTag.fromString(lastNotifiedTag)
        : null,
    });

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
    repository = new MonitoredRepoRepository(db);
    transactionManager = new DrizzleTransactionManager(db);
  });

  afterEach(async () => {
    await db.delete(schema.repoWatchers);
    await db.delete(schema.monitoredRepos);
  });

  it('persists and loads a monitored repo with watchers', async () => {
    const monitoredRepo = MonitoredRepo.create(
      RepoPath.fromString('owner/repo'),
    );
    monitoredRepo.addWatcher(createWatcher('sub-1', 'alice@example.com'));

    await save(monitoredRepo);

    const [loaded] = await repository.findAll();
    expect(loaded?.repo.toString()).toBe('owner/repo');
    expect(loaded?.watchers).toHaveLength(1);
    expect(loaded?.watchers[0]?.email.value).toBe('alice@example.com');
    expect(loaded?.watchers[0]?.lastNotifiedTag?.value).toBe('v1.0.0');
    expect(loaded?.lastSeenTag).toBeNull();
  });

  it('upserts repo cursor and watcher state on save', async () => {
    const monitoredRepo = MonitoredRepo.create(
      RepoPath.fromString('owner/repo'),
    );
    monitoredRepo.addWatcher(createWatcher('sub-1', 'alice@example.com'));
    await save(monitoredRepo);

    monitoredRepo.markReleaseSeen(ReleaseTag.fromString('v2.0.0'));
    monitoredRepo.markWatcherNotified('sub-1', ReleaseTag.fromString('v2.0.0'));
    await save(monitoredRepo);

    const [loaded] = await repository.findAll();
    expect(loaded?.lastSeenTag?.value).toBe('v2.0.0');
    expect(loaded?.watchers[0]?.lastNotifiedTag?.value).toBe('v2.0.0');
  });

  it('adds a second watcher to the same repo', async () => {
    const monitoredRepo = MonitoredRepo.create(
      RepoPath.fromString('owner/repo'),
    );
    monitoredRepo.addWatcher(createWatcher('sub-1', 'alice@example.com'));
    await save(monitoredRepo);

    monitoredRepo.addWatcher(
      createWatcher('sub-2', 'bob@example.com', 'v1.5.0'),
    );
    await save(monitoredRepo);

    const [loaded] = await repository.findAll();
    expect(loaded?.watchers).toHaveLength(2);
    expect(loaded?.watchers.map((watcher) => watcher.subscriptionId)).toEqual([
      'sub-1',
      'sub-2',
    ]);
  });

  it('removes stale watchers no longer present on the aggregate', async () => {
    const monitoredRepo = MonitoredRepo.create(
      RepoPath.fromString('owner/repo'),
    );
    const alice = createWatcher('sub-1', 'alice@example.com');
    const bob = createWatcher('sub-2', 'bob@example.com');
    monitoredRepo.addWatcher(alice);
    monitoredRepo.addWatcher(bob);
    await save(monitoredRepo);

    monitoredRepo.removeWatcher(bob);
    await save(monitoredRepo);

    const [loaded] = await repository.findAll();
    expect(loaded?.watchers).toHaveLength(1);
    expect(loaded?.watchers[0]?.subscriptionId).toBe('sub-1');
  });

  it('deletes the repo when the last watcher is removed', async () => {
    const monitoredRepo = MonitoredRepo.create(
      RepoPath.fromString('owner/repo'),
    );
    const watcher = createWatcher('sub-1', 'alice@example.com');
    monitoredRepo.addWatcher(watcher);
    await save(monitoredRepo);

    monitoredRepo.removeWatcher(watcher);
    await save(monitoredRepo);

    expect(await repository.findAll()).toEqual([]);
  });
});
