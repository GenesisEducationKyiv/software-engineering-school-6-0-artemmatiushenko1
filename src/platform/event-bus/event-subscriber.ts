import type { DeliveredEvent } from './domain-event-envelope.js';
import type { EventBus } from './event-bus.interface.js';

export abstract class EventSubscriber<T extends DeliveredEvent> {
  abstract readonly eventType: T['type'];

  abstract handle(event: T): void | Promise<void>;

  register(eventBus: EventBus): void {
    eventBus.subscribe(this.eventType, (event) => this.handle(event));
  }
}

export function registerEventSubscribers(
  eventBus: EventBus,
  subscribers: EventSubscriber<DeliveredEvent>[],
): void {
  for (const subscriber of subscribers) {
    subscriber.register(eventBus);
  }
}
