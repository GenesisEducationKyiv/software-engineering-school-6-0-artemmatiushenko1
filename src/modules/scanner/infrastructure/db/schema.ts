import { pgSchema, text, index } from 'drizzle-orm/pg-core';

export const scannerSchema = pgSchema('scanner');

export const monitoredRepos = scannerSchema.table('monitored_repos', {
  repo: text('repo').primaryKey(),
  lastSeenTag: text('last_seen_tag'),
});

export const repoWatchers = scannerSchema.table(
  'repo_watchers',
  {
    subscriptionId: text('subscription_id').primaryKey(),
    repo: text('repo')
      .notNull()
      .references(() => monitoredRepos.repo, { onDelete: 'cascade' }),
    lastNotifiedTag: text('last_notified_tag'),
  },
  (table) => [index('repo_watchers_repo_idx').on(table.repo)],
);
