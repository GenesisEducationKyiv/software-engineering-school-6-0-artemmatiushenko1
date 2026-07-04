export * from '../../modules/subscription/infrastructure/db/schema.js';
export * from '../../modules/scanner/infrastructure/db/schema.js';
export * from '../../modules/notification/infrastructure/db/schema.js';

import { isNull } from 'drizzle-orm';
import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';

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
