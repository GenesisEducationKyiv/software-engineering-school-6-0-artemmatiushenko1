import type {
  Delivered,
  IntegrationEvent,
} from '../event-bus/domain-event-envelope.js';
import { EventSubscriber } from '../event-bus/event-subscriber.js';
import type { IdempotencyGuard } from './idempotency-guard.js';

export abstract class IdempotentSubscriber<
  T extends Delivered<IntegrationEvent>,
> extends EventSubscriber<T> {
  protected abstract readonly name: string;

  constructor(protected readonly idempotencyGuard: IdempotencyGuard) {
    super();
  }

  protected deliveryKey(id: string): string {
    return `${id}:${this.name}`;
  }

  protected async claimAndRun(
    event: T,
    work: () => Promise<void>,
  ): Promise<void> {
    const claim = await this.idempotencyGuard.claim(this.deliveryKey(event.id));
    if (!claim) {
      return;
    }

    try {
      await work();
    } catch (error) {
      await claim.release();
      throw error;
    }
  }
}
