import type { DeliveredEvent } from '../event-bus/domain-event-envelope.js';

export type OutboxMessage = {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
};

export function toDeliveredEvent(message: OutboxMessage): DeliveredEvent {
  return {
    type: message.eventType,
    aggregateId: message.aggregateId,
    occurredAt: message.occurredAt,
    payload: message.payload,
    messageId: message.id,
  };
}
