import { z } from 'zod';
import {
  Email,
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../domain/index.js';

export const MonitoredRepoRowSchema = z.object({
  repo: z.string(),
  lastSeenTag: z.string().nullable(),
});

export const RepoWatcherRowSchema = z.object({
  subscriptionId: z.string(),
  repo: z.string(),
  email: z.string(),
  unsubscribeToken: z.string(),
  lastNotifiedTag: z.string().nullable(),
});

export type MonitoredRepoRow = z.infer<typeof MonitoredRepoRowSchema>;
export type RepoWatcherRow = z.infer<typeof RepoWatcherRowSchema>;

export class MonitoredRepoRowMapper {
  toDomain(
    repoRow: MonitoredRepoRow,
    watcherRows: RepoWatcherRow[],
  ): MonitoredRepo {
    const watchers = watcherRows.map((row) => this.watcherToDomain(row));

    return MonitoredRepo.rehydrate({
      repo: RepoPath.fromString(repoRow.repo),
      lastSeenTag: repoRow.lastSeenTag
        ? ReleaseTag.fromString(repoRow.lastSeenTag)
        : null,
      watchers,
    });
  }

  toRepoRow(monitoredRepo: MonitoredRepo): MonitoredRepoRow {
    return {
      repo: monitoredRepo.repo.toString(),
      lastSeenTag: monitoredRepo.lastSeenTag?.value ?? null,
    };
  }

  toWatcherRows(monitoredRepo: MonitoredRepo): RepoWatcherRow[] {
    const repo = monitoredRepo.repo.toString();

    return monitoredRepo.watchers.map((watcher) => ({
      subscriptionId: watcher.subscriptionId,
      repo,
      email: watcher.email.value,
      unsubscribeToken: watcher.unsubscribeToken,
      lastNotifiedTag: watcher.lastNotifiedTag?.value ?? null,
    }));
  }

  private watcherToDomain(row: RepoWatcherRow): RepoWatcher {
    return RepoWatcher.create({
      subscriptionId: row.subscriptionId,
      email: Email.fromString(row.email),
      unsubscribeToken: row.unsubscribeToken,
      lastNotifiedTag: row.lastNotifiedTag
        ? ReleaseTag.fromString(row.lastNotifiedTag)
        : null,
    });
  }
}
