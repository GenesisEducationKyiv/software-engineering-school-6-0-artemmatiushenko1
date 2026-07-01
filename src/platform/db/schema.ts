import { isNull } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'pending',
  'confirmed',
  'unsubscribed',
]);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    repo: text('repo').notNull(),
    status: subscriptionStatusEnum('status').default('pending').notNull(),
    confirmToken: text('confirm_token').notNull(),
    confirmExpiresAt: timestamp('confirm_expires_at', {
      withTimezone: true,
    }).notNull(),
    confirmUsedAt: timestamp('confirm_used_at', { withTimezone: true }),
    unsubscribeToken: text('unsubscribe_token'),
    unsubscribeUsedAt: timestamp('unsubscribe_used_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('email_repo_unique').on(table.email, table.repo),
    uniqueIndex('confirm_token_unique').on(table.confirmToken),
    uniqueIndex('unsubscribe_token_unique').on(table.unsubscribeToken),
  ],
);

export const monitoredRepos = pgTable('monitored_repos', {
  repo: text('repo').primaryKey(),
  lastSeenTag: text('last_seen_tag'),
});

export const repoWatchers = pgTable(
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

export const notificationRecipients = pgTable('notification_recipients', {
  subscriptionId: text('subscription_id').primaryKey(),
  email: text('email').notNull(),
  unsubscribeToken: text('unsubscribe_token').notNull(),
});

export const processedDeliveries = pgTable('processed_deliveries', {
  id: text('message_id').primaryKey(),
  processedAt: timestamp('processed_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const outboxMessages = pgTable(
  'outbox_messages',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    index('outbox_messages_pending_idx')
      .on(table.createdAt)
      .where(isNull(table.processedAt)),
  ],
);
