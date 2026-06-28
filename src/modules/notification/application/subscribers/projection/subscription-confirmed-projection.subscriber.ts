import type { SubscriptionConfirmedEvent } from '../../../../subscription/api/events.js';
import type { RecipientRepository } from '../../ports/recipient.repository.js';
import { Email, Recipient } from '../../../domain/index.js';

export class SubscriptionConfirmedProjectionSubscriber {
  constructor(private readonly recipientRepository: RecipientRepository) {}

  async handle(event: SubscriptionConfirmedEvent): Promise<void> {
    const recipient = Recipient.create(
      event.aggregateId,
      Email.fromString(event.payload.email),
      event.payload.unsubscribeToken,
    );

    await this.recipientRepository.save(recipient);
  }
}
