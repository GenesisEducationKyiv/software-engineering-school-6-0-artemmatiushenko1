import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { SubscriptionEventType } from '../../../subscription/api/events.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';
import {
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../../domain/index.js';
import { SubscriptionDeactivatedSubscriber } from './subscription-deactivated.subscriber.js';

describe('Scanner SubscriptionDeactivatedSubscriber', () => {
  const event = {
    type: SubscriptionEventType.Deactivated,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    payload: {
      repo: 'owner/repo',
    },
  } as const;

  const createRepoWithWatchers = () => {
    const monitoredRepo = MonitoredRepo.create(
      RepoPath.fromString('owner/repo'),
    );
    monitoredRepo.addWatcher(
      RepoWatcher.create({
        subscriptionId: 'sub-1',
        lastNotifiedTag: ReleaseTag.fromString('v1.0.0'),
      }),
    );
    monitoredRepo.addWatcher(
      RepoWatcher.create({
        subscriptionId: 'sub-2',
        lastNotifiedTag: ReleaseTag.fromString('v1.0.0'),
      }),
    );
    return monitoredRepo;
  };

  it('removes the watcher and saves the monitored repo', async () => {
    const monitoredRepoRepository = mock<MonitoredRepoRepository>();
    monitoredRepoRepository.findByRepo.mockResolvedValue(
      createRepoWithWatchers(),
    );

    const transactionManager = mock<TransactionManager>();
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );

    const subscriber = new SubscriptionDeactivatedSubscriber(
      monitoredRepoRepository,
      transactionManager,
    );

    await subscriber.handle(event);

    expect(monitoredRepoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        watchers: [expect.objectContaining({ subscriptionId: 'sub-2' })],
      }),
      expect.anything(),
    );
  });

  it('deletes the monitored repo when the last watcher is removed', async () => {
    const monitoredRepo = MonitoredRepo.create(
      RepoPath.fromString('owner/repo'),
    );
    monitoredRepo.addWatcher(
      RepoWatcher.create({
        subscriptionId: 'sub-1',
        lastNotifiedTag: null,
      }),
    );

    const monitoredRepoRepository = mock<MonitoredRepoRepository>();
    monitoredRepoRepository.findByRepo.mockResolvedValue(monitoredRepo);

    const transactionManager = mock<TransactionManager>();
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );

    const subscriber = new SubscriptionDeactivatedSubscriber(
      monitoredRepoRepository,
      transactionManager,
    );

    await subscriber.handle(event);

    expect(monitoredRepoRepository.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: RepoPath.fromString('owner/repo'),
        watchers: [],
      }),
      expect.anything(),
    );
    expect(monitoredRepoRepository.save).not.toHaveBeenCalled();
  });

  it('does nothing when the repo is not monitored', async () => {
    const monitoredRepoRepository = mock<MonitoredRepoRepository>();
    monitoredRepoRepository.findByRepo.mockResolvedValue(null);

    const transactionManager = mock<TransactionManager>();
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );

    const subscriber = new SubscriptionDeactivatedSubscriber(
      monitoredRepoRepository,
      transactionManager,
    );

    await subscriber.handle(event);

    expect(monitoredRepoRepository.save).not.toHaveBeenCalled();
    expect(monitoredRepoRepository.delete).not.toHaveBeenCalled();
  });

  it('does nothing when the watcher is not found', async () => {
    const monitoredRepo = MonitoredRepo.create(
      RepoPath.fromString('owner/repo'),
    );
    monitoredRepo.addWatcher(
      RepoWatcher.create({
        subscriptionId: 'sub-2',
        lastNotifiedTag: null,
      }),
    );

    const monitoredRepoRepository = mock<MonitoredRepoRepository>();
    monitoredRepoRepository.findByRepo.mockResolvedValue(monitoredRepo);

    const transactionManager = mock<TransactionManager>();
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );

    const subscriber = new SubscriptionDeactivatedSubscriber(
      monitoredRepoRepository,
      transactionManager,
    );

    await subscriber.handle(event);

    expect(monitoredRepoRepository.save).not.toHaveBeenCalled();
    expect(monitoredRepoRepository.delete).not.toHaveBeenCalled();
  });
});
