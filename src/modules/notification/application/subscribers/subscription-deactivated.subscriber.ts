import {
  SubscriptionEventType,
  type SubscriptionDeactivatedEvent,
} from '../../../subscription/api/events.js';
import { EventSubscriber } from '../../../../platform/event-bus/event-subscriber.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';

export class SubscriptionDeactivatedSubscriber extends EventSubscriber<SubscriptionDeactivatedEvent> {
  readonly eventType = SubscriptionEventType.Deactivated;
  constructor(private readonly recipientRepository: RecipientRepository) {
    super();
  }

  async handle(event: SubscriptionDeactivatedEvent): Promise<void> {
    await this.recipientRepository.delete(event.aggregateId);
  }
}
