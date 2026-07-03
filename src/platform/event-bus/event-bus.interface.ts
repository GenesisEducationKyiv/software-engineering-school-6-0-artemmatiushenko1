import type { DeliveredEvent } from './domain-event-envelope.js';

export interface EventBus {
  publish(events: DeliveredEvent[]): Promise<void>;
  subscribe<T extends DeliveredEvent>(
    eventType: T['type'],
    callback: (event: T) => void | Promise<void>,
  ): void;
}
