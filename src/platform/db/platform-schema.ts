import { isNull } from 'drizzle-orm';
import { pgSchema, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';

export const platformSchema = pgSchema('platform');

export const processedDeliveries = platformSchema.table(
  'processed_deliveries',
  {
    id: text('message_id').primaryKey(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const outboxMessages = platformSchema.table(
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
