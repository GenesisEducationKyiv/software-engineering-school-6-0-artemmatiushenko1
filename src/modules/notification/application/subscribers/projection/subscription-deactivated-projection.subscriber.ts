import type { SubscriptionDeactivatedEvent } from '../../../../subscription/api/events.js';
import type { RecipientRepository } from '../../ports/recipient.repository.js';

export class SubscriptionDeactivatedProjectionSubscriber {
  constructor(private readonly recipientRepository: RecipientRepository) {}

  async handle(event: SubscriptionDeactivatedEvent): Promise<void> {
    await this.recipientRepository.delete(event.aggregateId);
  }
}
