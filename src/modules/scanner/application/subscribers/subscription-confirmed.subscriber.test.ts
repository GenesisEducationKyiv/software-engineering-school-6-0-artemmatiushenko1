import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';
import type { GithubClient } from '../../../github/api/github-client.interface.js';
import {
  SubscriptionEventType,
  type SubscriptionConfirmedEvent,
} from '../../../subscription/api/events.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import {
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../../domain/index.js';
import { SubscriptionConfirmedSubscriber } from './subscription-confirmed.subscriber.js';

describe('Scanner SubscriptionConfirmedSubscriber', () => {
  const event: Delivered<SubscriptionConfirmedEvent> = {
    type: SubscriptionEventType.Confirmed,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    id: 'msg-1',
    payload: {
      email: 'alice@example.com',
      repo: 'owner/repo',
      unsubscribeToken: 'unsub-token',
    },
  };

  const idempotencyGuard = mock<IdempotencyGuard>();
  const monitoredRepoRepository = mock<MonitoredRepoRepository>();
  const transactionManager = mock<TransactionManager>();
  const githubClient = mock<GithubClient>();

  let subscriber: SubscriptionConfirmedSubscriber;

  beforeEach(() => {
    vi.resetAllMocks();

    idempotencyGuard.isProcessed.mockResolvedValue(false);
    monitoredRepoRepository.findByRepo.mockResolvedValue(null);
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );
    githubClient.getLatestRelease.mockResolvedValue({
      tag: 'v1.0.0',
      name: 'v1.0.0',
      publishedAt: null,
    });

    subscriber = new SubscriptionConfirmedSubscriber(
      idempotencyGuard,
      monitoredRepoRepository,
      transactionManager,
      githubClient,
    );
  });

  it('creates a monitored repo and saves a watcher with baseline tag', async () => {
    await subscriber.handle(event);

    expect(idempotencyGuard.isProcessed).toHaveBeenCalledWith(
      'msg-1:scanner:subscription-confirmed',
    );
    expect(idempotencyGuard.markProcessed).toHaveBeenCalledWith(
      'msg-1:scanner:subscription-confirmed',
    );
    expect(githubClient.getLatestRelease).toHaveBeenCalledWith('owner', 'repo');
    expect(monitoredRepoRepository.findByRepo).toHaveBeenCalledWith(
      RepoPath.fromString('owner/repo'),
      expect.anything(),
    );
    expect(monitoredRepoRepository.save).toHaveBeenCalledWith(
      MonitoredRepo.rehydrate({
        repo: RepoPath.fromString('owner/repo'),
        watchers: [
          RepoWatcher.create({
            subscriptionId: 'sub-1',
            lastNotifiedTag: ReleaseTag.fromString('v1.0.0'),
          }),
        ],
        lastSeenTag: ReleaseTag.fromString('v1.0.0'),
      }),
      expect.anything(),
    );
  });

  it('adds a watcher to an existing monitored repo', async () => {
    const existing = MonitoredRepo.create(RepoPath.fromString('owner/repo'));
    existing.addWatcher(
      RepoWatcher.create({
        subscriptionId: 'sub-0',
        lastNotifiedTag: ReleaseTag.fromString('v0.9.0'),
      }),
    );
    monitoredRepoRepository.findByRepo.mockResolvedValue(existing);

    await subscriber.handle(event);

    expect(monitoredRepoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        watchers: expect.arrayContaining([
          expect.objectContaining({
            subscriptionId: 'sub-0',
            lastNotifiedTag: ReleaseTag.fromString('v0.9.0'),
          }),
          expect.objectContaining({
            subscriptionId: 'sub-1',
            lastNotifiedTag: ReleaseTag.fromString('v1.0.0'),
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('stores null lastNotifiedTag when the repository has no releases', async () => {
    githubClient.getLatestRelease.mockResolvedValue(null);

    await subscriber.handle(event);

    expect(monitoredRepoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        watchers: [
          expect.objectContaining({
            lastNotifiedTag: null,
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it('does not re-fetch GitHub or overwrite watcher on duplicate outbox delivery', async () => {
    idempotencyGuard.isProcessed.mockResolvedValue(true);

    await subscriber.handle(event);

    expect(githubClient.getLatestRelease).not.toHaveBeenCalled();
    expect(monitoredRepoRepository.findByRepo).not.toHaveBeenCalled();
    expect(monitoredRepoRepository.save).not.toHaveBeenCalled();
  });

  it('does not mark processed when save fails', async () => {
    transactionManager.run.mockRejectedValue(new Error('save failed'));

    await expect(subscriber.handle(event)).rejects.toThrow('save failed');

    expect(idempotencyGuard.markProcessed).not.toHaveBeenCalled();
  });
});
