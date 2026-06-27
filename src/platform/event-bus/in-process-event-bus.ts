import type { DomainEvent } from './domain-event.js';
import type { EventBus } from './event-bus.interface.js';

type EventHandler = (event: DomainEvent) => void;

export class InProcessEventBus implements EventBus {
  private readonly subscribers: Map<string, EventHandler> = new Map();

  publish<T>(event: DomainEvent<T>): Promise<void> {
    this.subscribers.get(event.type)?.(event);
    return Promise.resolve();
  }

  subscribe<T>(
    event: DomainEvent<T>,
    callback: (event: DomainEvent<T>) => void,
  ): void {
    this.subscribers.set(event.type, callback as EventHandler);
  }
}
