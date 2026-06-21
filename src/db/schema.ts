import {
  pgTable,
  serial,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { SubscriptionStatusSchema } from '../modules/subscription/domain/subscription.js';

export const scopeEnum = pgEnum('scope', ['subscribe', 'unsubscribe']);

export const subscriptionStatusEnum = pgEnum(
  'subscription_status',
  SubscriptionStatusSchema.enum,
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    repo: text('repo').notNull(),
    status: subscriptionStatusEnum('status').default('pending').notNull(),
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
