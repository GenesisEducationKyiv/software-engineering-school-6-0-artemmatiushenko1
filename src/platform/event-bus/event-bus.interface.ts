import type { Delivered, IntegrationEvent } from './domain-event-envelope.js';

export interface EventBus {
  publish(events: Delivered<IntegrationEvent>[]): Promise<void>;
  subscribe<T extends Delivered<IntegrationEvent>>(
    eventType: T['type'],
    callback: (event: T) => void | Promise<void>,
  ): void;
}
