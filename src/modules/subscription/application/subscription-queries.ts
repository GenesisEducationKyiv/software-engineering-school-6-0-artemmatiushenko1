import type { SubscriptionQueries } from '../api/subscription-queries.interface.js';
import type { SubscriptionRepository } from './ports/subscription.repository.js';
import { SubscriptionNotFoundError } from './errors.js';
import { ReleaseTag } from '../domain/release-tag.js';
import type { TransactionManager } from '../../../shared-kernel/index.js';

export class SubscriptionQueriesImpl implements SubscriptionQueries {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private transactionManager: TransactionManager,
  ) {}

  async findAllConfirmedSubscriptions() {
    return this.subscriptionRepo.findAllConfirmed();
  }

  async observeNewRelease(subscriptionId: string, tag: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findById(subscriptionId);

    if (!subscription) {
      throw new SubscriptionNotFoundError();
    }

    const newTag = ReleaseTag.fromString(tag);

    if (subscription.lastSeenTag?.equals(newTag)) {
      return;
    }

    subscription.observeRelease(newTag);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });
  }
}
