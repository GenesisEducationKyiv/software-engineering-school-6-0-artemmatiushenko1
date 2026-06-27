import type { DomainEvent } from './domain-event.js';

export interface EventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(
    event: DomainEvent<T>,
    callback: (event: DomainEvent<T>) => void,
  ): void;
}
