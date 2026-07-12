import type { Delivered, IntegrationEvent } from './domain-event-envelope.js';
import type { Logger } from '../../shared-kernel/logger.js';
import type { EventBus } from './event-bus.interface.js';

type EventHandler = (
  event: Delivered<IntegrationEvent>,
) => void | Promise<void>;

export class InProcessEventBus implements EventBus {
  private readonly subscribers = new Map<string, EventHandler[]>();

  constructor(private readonly logger?: Logger) {}

  async publish(events: Delivered<IntegrationEvent>[]): Promise<void> {
    const failures: Error[] = [];

    for (const event of events) {
      const handlers = this.subscribers.get(event.type);
      if (!handlers) continue;

      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger?.error('Event handler failed', err, {
            eventType: event.type,
            aggregateId: event.aggregateId,
          });
          failures.push(err);
        }
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'One or more event handlers failed');
    }
  }

  subscribe<T extends Delivered<IntegrationEvent>>(
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
