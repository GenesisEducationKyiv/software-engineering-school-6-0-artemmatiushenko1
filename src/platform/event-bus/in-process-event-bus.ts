import type { DomainEventEnvelope } from './domain-event-envelope.js';
import type { EventBus } from './event-bus.interface.js';

type EventHandler = (event: DomainEventEnvelope) => void | Promise<void>;

export class InProcessEventBus implements EventBus {
  private readonly subscribers = new Map<string, EventHandler[]>();

  async publish(events: DomainEventEnvelope[]): Promise<void> {
    for (const event of events) {
      const handlers = this.subscribers.get(event.type);
      if (!handlers) continue;

      for (const handler of handlers) {
        await handler(event);
      }
    }
  }

  subscribe<T extends DomainEventEnvelope>(
    eventType: T['type'],
    callback: (event: T) => void | Promise<void>,
  ): void {
    const handlers = this.subscribers.get(eventType) ?? [];
    handlers.push(callback as EventHandler);
    this.subscribers.set(eventType, handlers);
  }

  dispose(): void {
    this.subscribers.clear();
  }
}
