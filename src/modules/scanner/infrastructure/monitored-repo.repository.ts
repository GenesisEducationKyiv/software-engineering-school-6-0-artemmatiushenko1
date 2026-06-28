import { and, eq, notInArray } from 'drizzle-orm';
import { monitoredRepos, repoWatchers } from '../../../platform/db/schema.js';
import type {
  Database,
  Transaction as DrizzleTransaction,
} from '../../../platform/db/types.js';
import type { DomainTransaction } from '../../../shared-kernel/transaction.js';
import type { MonitoredRepoRepository as MonitoredRepoRepositoryPort } from '../application/ports/monitored-repo.repository.js';
import type { MonitoredRepo } from '../domain/index.js';
import {
  MonitoredRepoRowMapper,
  MonitoredRepoRowSchema,
  RepoWatcherRowSchema,
} from './monitored-repo-row.mapper.js';

export class MonitoredRepoRepository implements MonitoredRepoRepositoryPort {
  private readonly mapper = new MonitoredRepoRowMapper();

  constructor(private readonly db: Database) {}

  private getDb(tx: DomainTransaction): DrizzleTransaction {
    return tx as unknown as DrizzleTransaction;
  }

  async findAll(): Promise<MonitoredRepo[]> {
    const repoRows = await this.db.select().from(monitoredRepos);
    const watcherRows = await this.db.select().from(repoWatchers);

    const watchersByRepo = new Map<string, typeof watcherRows>();
    for (const watcherRow of watcherRows) {
      const watchers = watchersByRepo.get(watcherRow.repo) ?? [];
      watchers.push(watcherRow);
      watchersByRepo.set(watcherRow.repo, watchers);
    }

    return repoRows.flatMap((repoRow) => {
      const watchers = watchersByRepo.get(repoRow.repo) ?? [];
      if (watchers.length === 0) {
        return [];
      }

      return [
        this.mapper.toDomain(
          MonitoredRepoRowSchema.parse(repoRow),
          watchers.map((row) => RepoWatcherRowSchema.parse(row)),
        ),
      ];
    });
  }

  async save(
    monitoredRepo: MonitoredRepo,
    tx: DomainTransaction,
  ): Promise<void> {
    const db = this.getDb(tx);
    const repo = monitoredRepo.repo.toString();

    if (monitoredRepo.watchers.length === 0) {
      await db.delete(monitoredRepos).where(eq(monitoredRepos.repo, repo));
      return;
    }

    const repoRow = this.mapper.toRepoRow(monitoredRepo);
    await db
      .insert(monitoredRepos)
      .values(repoRow)
      .onConflictDoUpdate({
        target: monitoredRepos.repo,
        set: { lastSeenTag: repoRow.lastSeenTag },
      });

    const watcherRows = this.mapper.toWatcherRows(monitoredRepo);
    const subscriptionIds = watcherRows.map((row) => row.subscriptionId);

    for (const watcherRow of watcherRows) {
      await db
        .insert(repoWatchers)
        .values(watcherRow)
        .onConflictDoUpdate({
          target: repoWatchers.subscriptionId,
          set: {
            repo: watcherRow.repo,
            email: watcherRow.email,
            unsubscribeToken: watcherRow.unsubscribeToken,
            lastNotifiedTag: watcherRow.lastNotifiedTag,
          },
        });
    }

    await db
      .delete(repoWatchers)
      .where(
        and(
          eq(repoWatchers.repo, repo),
          notInArray(repoWatchers.subscriptionId, subscriptionIds),
        ),
      );
  }
}
