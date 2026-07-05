import {
  SubscriptionEventType,
  type SubscriptionDeactivatedEvent,
} from '../../../subscription/api/events.js';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import { EventSubscriber } from '../../../../platform/event-bus/event-subscriber.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';

export class SubscriptionDeactivatedSubscriber extends EventSubscriber<
  Delivered<SubscriptionDeactivatedEvent>
> {
  protected readonly name = 'notification:subscription-deactivated';
  readonly eventType = SubscriptionEventType.Deactivated;

  constructor(private readonly recipientRepository: RecipientRepository) {
    super();
  }

  async handle(event: Delivered<SubscriptionDeactivatedEvent>): Promise<void> {
    await this.recipientRepository.delete(event.aggregateId);
  }
}
