import type {
  Delivered,
  IntegrationEvent,
} from '../event-bus/domain-event-envelope.js';
import { EventSubscriber } from '../event-bus/event-subscriber.js';
import type { IdempotencyGuard } from './idempotency-guard.js';

export abstract class IdempotentSubscriber<
  T extends IntegrationEvent,
> extends EventSubscriber<Delivered<T>> {
  protected abstract readonly name: string;

  constructor(protected readonly idempotencyGuard: IdempotencyGuard) {
    super();
  }

  protected deliveryKey(id: string): string {
    return `${id}:${this.name}`;
  }

  protected async claimAndRun(
    event: Delivered<T>,
    work: () => Promise<void>,
  ): Promise<void> {
    const key = this.deliveryKey(event.id);
    if (await this.idempotencyGuard.isProcessed(key)) {
      return;
    }

    await work();
    await this.idempotencyGuard.markProcessed(key);
  }
}
