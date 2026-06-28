import type { SubscriptionDeactivatedEvent } from '../../../subscription/api/events.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import { RepoPath } from '../../domain/index.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';

export class SubscriptionDeactivatedSubscriber {
  constructor(
    private readonly monitoredRepoRepository: MonitoredRepoRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  async handle(event: SubscriptionDeactivatedEvent): Promise<void> {
    const repo = RepoPath.fromString(event.payload.repo);

    await this.transactionManager.run(async (tx) => {
      const monitoredRepo = await this.monitoredRepoRepository.findByRepo(
        repo,
        tx,
      );

      if (!monitoredRepo) {
        return;
      }

      const watcher = monitoredRepo.watchers.find(
        (existing) => existing.subscriptionId === event.aggregateId,
      );

      if (!watcher) {
        return;
      }

      monitoredRepo.removeWatcher(watcher);
      await this.monitoredRepoRepository.save(monitoredRepo, tx);
    });
  }
}
