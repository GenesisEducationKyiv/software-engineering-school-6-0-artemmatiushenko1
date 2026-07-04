import { pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const subscriptionSchema = pgSchema('subscription');

export const subscriptionStatusEnum = subscriptionSchema.enum(
  'subscription_status',
  ['pending', 'confirmed', 'unsubscribed'],
);

export const subscriptions = subscriptionSchema.table(
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
