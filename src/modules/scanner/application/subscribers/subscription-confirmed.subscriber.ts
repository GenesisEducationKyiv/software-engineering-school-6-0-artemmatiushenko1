import {
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../../domain/index.js';
import {
  SubscriptionEventType,
  type SubscriptionConfirmedEvent,
} from '../../../subscription/api/events.js';
import { EventSubscriber } from '../../../../platform/event-bus/event-subscriber.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import { deliveryKey } from '../../../../platform/idempotency-guard/delivery-key.js';
import type { GithubClient } from '../../../github/api/github-client.interface.js';

const CONSUMER = 'scanner:subscription-confirmed';

export class SubscriptionConfirmedSubscriber extends EventSubscriber<SubscriptionConfirmedEvent> {
  readonly eventType = SubscriptionEventType.Confirmed;
  constructor(
    private readonly idempotencyGuard: IdempotencyGuard,
    private readonly monitoredRepoRepository: MonitoredRepoRepository,
    private readonly transactionManager: TransactionManager,
    private readonly githubClient: GithubClient,
  ) {
    super();
  }

  async handle(event: SubscriptionConfirmedEvent): Promise<void> {
    const claim = await this.idempotencyGuard.claim(
      deliveryKey(event.messageId, CONSUMER),
    );
    if (!claim) {
      return;
    }

    try {
      await this.addWatcher(event);
    } catch (error) {
      await claim.release();
      throw error;
    }
  }

  private async addWatcher(event: SubscriptionConfirmedEvent): Promise<void> {
    const repo = RepoPath.fromString(event.payload.repo);
    const latestRelease = await this.githubClient.getLatestRelease(
      repo.owner,
      repo.repo,
    );
    const lastNotifiedTag = latestRelease
      ? ReleaseTag.fromString(latestRelease.tag)
      : null;

    await this.transactionManager.run(async (tx) => {
      const existing = await this.monitoredRepoRepository.findByRepo(repo, tx);
      const monitoredRepo = existing ?? MonitoredRepo.create(repo);

      monitoredRepo.addWatcher(
        RepoWatcher.create({
          subscriptionId: event.aggregateId,
          lastNotifiedTag,
        }),
      );

      await this.monitoredRepoRepository.save(monitoredRepo, tx);
    });
  }
}
