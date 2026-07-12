import {
  SubscriptionEventType,
  type SubscriptionDeactivatedEvent,
} from '../../../subscription/api/events.js';
import { EventSubscriber } from '../../../../platform/event-bus/event-subscriber.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import { RepoPath } from '../../domain/index.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';

export class SubscriptionDeactivatedSubscriber extends EventSubscriber<SubscriptionDeactivatedEvent> {
  readonly eventType = SubscriptionEventType.Deactivated;

  constructor(
    private readonly monitoredRepoRepository: MonitoredRepoRepository,
    private readonly transactionManager: TransactionManager,
  ) {
    super();
  }

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

      if (monitoredRepo.removeWatcher(watcher)) {
        await this.monitoredRepoRepository.delete(monitoredRepo, tx);
        return;
      }

      await this.monitoredRepoRepository.save(monitoredRepo, tx);
    });
  }
}
