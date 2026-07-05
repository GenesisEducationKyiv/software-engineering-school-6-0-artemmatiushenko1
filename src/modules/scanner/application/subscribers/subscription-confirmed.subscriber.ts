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
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import { IdempotentSubscriber } from '../../../../platform/idempotency-guard/idempotent.subscriber.js';
import type { GithubClient } from '../../../github/api/github-client.interface.js';

export class SubscriptionConfirmedSubscriber extends IdempotentSubscriber<SubscriptionConfirmedEvent> {
  protected readonly name = 'scanner:subscription-confirmed';
  readonly eventType = SubscriptionEventType.Confirmed;

  constructor(
    idempotencyGuard: IdempotencyGuard,
    private readonly monitoredRepoRepository: MonitoredRepoRepository,
    private readonly transactionManager: TransactionManager,
    private readonly githubClient: GithubClient,
  ) {
    super(idempotencyGuard);
  }

  async handle(event: Delivered<SubscriptionConfirmedEvent>): Promise<void> {
    await this.runIfNotProcessed(event, () => this.addWatcher(event));
  }

  private async addWatcher(
    event: Delivered<SubscriptionConfirmedEvent>,
  ): Promise<void> {
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

      if (!existing && lastNotifiedTag) {
        monitoredRepo.markReleaseSeen(lastNotifiedTag);
      }

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
