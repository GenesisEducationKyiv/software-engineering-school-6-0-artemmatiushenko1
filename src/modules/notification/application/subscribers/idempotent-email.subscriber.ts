import type { DeliveredEvent } from '../../../../platform/event-bus/domain-event-envelope.js';
import { EventSubscriber } from '../../../../platform/event-bus/event-subscriber.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import { deliveryKey } from '../../../../platform/idempotency-guard/delivery-key.js';

export abstract class IdempotentEmailSubscriber<
  T extends DeliveredEvent,
> extends EventSubscriber<T> {
  constructor(
    protected readonly idempotencyGuard: IdempotencyGuard,
    private readonly consumer: string,
  ) {
    super();
  }

  protected abstract deliver(event: T): Promise<void>;

  async handle(event: T): Promise<void> {
    await this.deliverIdempotently(event);
  }

  protected async deliverIdempotently(event: T): Promise<void> {
    const claim = await this.idempotencyGuard.claim(
      deliveryKey(event.messageId, this.consumer),
    );
    if (!claim) {
      return;
    }

    try {
      await this.deliver(event);
    } catch (error) {
      await claim.release();
      throw error;
    }
  }
}
