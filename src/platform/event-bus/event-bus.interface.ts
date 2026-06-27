import type { DomainEventEnvelope } from './domain-event-envelope.js';

export interface EventBus {
  publish(events: DomainEventEnvelope[]): Promise<void>;
  subscribe<T extends DomainEventEnvelope>(
    eventType: T['type'],
    callback: (event: T) => void | Promise<void>,
  ): void;
}
