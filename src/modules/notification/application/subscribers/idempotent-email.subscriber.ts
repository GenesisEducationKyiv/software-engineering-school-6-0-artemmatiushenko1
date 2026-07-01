import type { DomainEventEnvelope } from '../../../../platform/event-bus/domain-event-envelope.js';
import { EventSubscriber } from '../../../../platform/event-bus/event-subscriber.js';
import type { DeliveryDedup } from '../../../../platform/delivery-dedup/delivery-dedup.js';

export abstract class IdempotentEmailSubscriber<
  T extends DomainEventEnvelope,
> extends EventSubscriber<T> {
  constructor(protected readonly deliveryDedup: DeliveryDedup) {
    super();
  }

  protected abstract deliver(event: T): Promise<void>;

  async handle(event: T): Promise<void> {
    await this.deliverIdempotently(event);
  }

  protected async deliverIdempotently(event: T): Promise<void> {
    const claim = await this.deliveryDedup.claim(event.id);
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
