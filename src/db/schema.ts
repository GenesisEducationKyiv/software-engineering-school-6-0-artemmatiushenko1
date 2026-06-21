import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const scopeEnum = pgEnum('scope', ['subscribe', 'unsubscribe']);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    repo: text('repo').notNull(),
    confirmed: boolean('confirmed').default(false).notNull(),
    lastSeenTag: text('last_seen_tag'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('email_repo_unique').on(table.email, table.repo)],
);

export const subscriptionTokens = pgTable('subscription_tokens', {
  id: serial('id').primaryKey(),
  token: text('token').notNull(),
  subscriptionId: text('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),
  scope: scopeEnum('scope').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
