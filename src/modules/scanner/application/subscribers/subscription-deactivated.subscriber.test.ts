import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';
import {
  SubscriptionEventType,
  type SubscriptionDeactivatedEvent,
} from '../../../subscription/api/events.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import {
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../../domain/index.js';
import { SubscriptionDeactivatedSubscriber } from './subscription-deactivated.subscriber.js';

describe('Scanner SubscriptionDeactivatedSubscriber', () => {
  const event: Delivered<SubscriptionDeactivatedEvent> = {
    type: SubscriptionEventType.Deactivated,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    id: 'msg-1',
    payload: {
      repo: 'owner/repo',
    },
  };

  const monitoredRepoRepository = mock<MonitoredRepoRepository>();
  const transactionManager = mock<TransactionManager>();

  let subscriber: SubscriptionDeactivatedSubscriber;

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

  beforeEach(() => {
    vi.resetAllMocks();

    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );

    subscriber = new SubscriptionDeactivatedSubscriber(
      monitoredRepoRepository,
      transactionManager,
    );
  });

  it('removes the watcher and saves the monitored repo', async () => {
    monitoredRepoRepository.findByRepo.mockResolvedValue(
      createRepoWithWatchers(),
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
    monitoredRepoRepository.findByRepo.mockResolvedValue(monitoredRepo);

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
    monitoredRepoRepository.findByRepo.mockResolvedValue(null);

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
    monitoredRepoRepository.findByRepo.mockResolvedValue(monitoredRepo);

    await subscriber.handle(event);

    expect(monitoredRepoRepository.save).not.toHaveBeenCalled();
    expect(monitoredRepoRepository.delete).not.toHaveBeenCalled();
  });
});
