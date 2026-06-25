import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
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
    lastSeenTag: text('last_seen_tag'),
    confirmToken: text('confirm_token').notNull(),
    confirmExpiresAt: timestamp('confirm_expires_at').notNull(),
    confirmUsedAt: timestamp('confirm_used_at'),
    unsubscribeToken: text('unsubscribe_token'),
    unsubscribeExpiresAt: timestamp('unsubscribe_expires_at'),
    unsubscribeUsedAt: timestamp('unsubscribe_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('email_repo_unique').on(table.email, table.repo),
    uniqueIndex('confirm_token_unique').on(table.confirmToken),
    uniqueIndex('unsubscribe_token_unique').on(table.unsubscribeToken),
  ],
);
