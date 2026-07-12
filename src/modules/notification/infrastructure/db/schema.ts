import { pgSchema, text } from 'drizzle-orm/pg-core';

export const notificationSchema = pgSchema('notification');

export const notificationRecipients = notificationSchema.table(
  'notification_recipients',
  {
    subscriptionId: text('subscription_id').primaryKey(),
    email: text('email').notNull(),
    unsubscribeToken: text('unsubscribe_token').notNull(),
  },
);
