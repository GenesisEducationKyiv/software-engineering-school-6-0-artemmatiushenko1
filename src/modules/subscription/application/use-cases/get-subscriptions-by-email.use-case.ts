import type { Subscription } from '../../domain/subscription.js';
import type { SubscriptionRepository } from '../ports/subscription.repository.js';
import { Email } from '../../../../shared-kernel/index.js';

export class GetSubscriptionsByEmailUseCase {
  constructor(private subscriptionRepo: SubscriptionRepository) {}

  async execute(email: string): Promise<Subscription[]> {
    return this.subscriptionRepo.findConfirmedSubscriptionsByEmail(
      Email.fromString(email),
    );
  }
}
