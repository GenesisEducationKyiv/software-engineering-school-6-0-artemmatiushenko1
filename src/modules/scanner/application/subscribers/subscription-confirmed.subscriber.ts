import {
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../../domain/index.js';
import type { SubscriptionConfirmedEvent } from '../../../subscription/api/events.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';

export class SubscriptionConfirmedSubscriber {
  constructor(
    private readonly monitoredRepoRepository: MonitoredRepoRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async handle(event: SubscriptionConfirmedEvent): Promise<void> {
    const repo = RepoPath.fromString(event.payload.repo);
    const lastNotifiedTag = event.payload.baselineTag
      ? ReleaseTag.fromString(event.payload.baselineTag)
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
