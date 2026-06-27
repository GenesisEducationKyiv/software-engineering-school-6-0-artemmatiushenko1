import type { DomainEventEnvelope } from './domain-event-envelope.js';
import type { EventBus } from './event-bus.interface.js';

type EventHandler = (event: DomainEventEnvelope) => void | Promise<void>;
// TODO: what if there are mutliple subscibers per event type?
export class InProcessEventBus implements EventBus {
  private readonly subscribers: Map<string, EventHandler> = new Map();

  async publish(events: DomainEventEnvelope[]): Promise<void> {
    for (const event of events) {
      const handler = this.subscribers.get(event.type);
      if (handler) {
        await handler(event);
      }
    }
  }

  subscribe<T extends DomainEventEnvelope>(
    eventType: T['type'],
    callback: (event: T) => void | Promise<void>,
  ): void {
    this.subscribers.set(eventType, callback as EventHandler);
  }
}
