import type { DomainEventEnvelope } from '../event-bus/domain-event-envelope.js';

export type OutboxMessage = {
  readonly id: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: unknown;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
};

export function toDomainEventEnvelope(
  message: OutboxMessage,
): DomainEventEnvelope {
  return {
    type: message.eventType,
    aggregateId: message.aggregateId,
    occurredAt: message.occurredAt,
    payload: message.payload,
    id: message.id,
  };
}
