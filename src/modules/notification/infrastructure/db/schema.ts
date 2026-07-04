import { pgTable, text } from 'drizzle-orm/pg-core';

export const notificationRecipients = pgTable('notification_recipients', {
  subscriptionId: text('subscription_id').primaryKey(),
  email: text('email').notNull(),
  unsubscribeToken: text('unsubscribe_token').notNull(),
});
