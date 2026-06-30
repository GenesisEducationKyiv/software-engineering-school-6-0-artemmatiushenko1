import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { SubscriptionEventType } from '../../../subscription/api/events.js';
import type { MonitoredRepoRepository } from '../ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../../shared-kernel/transaction.js';
import type { GithubClient } from '../../../github/api/github-client.interface.js';
import {
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../../domain/index.js';
import { SubscriptionConfirmedSubscriber } from './subscription-confirmed.subscriber.js';

describe('Scanner SubscriptionConfirmedSubscriber', () => {
  const event = {
    type: SubscriptionEventType.Confirmed,
    aggregateId: 'sub-1',
    occurredAt: new Date('2024-01-01T00:00:00.000Z'),
    payload: {
      email: 'alice@example.com',
      repo: 'owner/repo',
      unsubscribeToken: 'unsub-token',
    },
  } as const;

  it('creates a monitored repo and saves a watcher with baseline tag', async () => {
    const monitoredRepoRepository = mock<MonitoredRepoRepository>();
    monitoredRepoRepository.findByRepo.mockResolvedValue(null);

    const transactionManager = mock<TransactionManager>();
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );

    const githubClient = mock<GithubClient>();
    githubClient.getLatestRelease.mockResolvedValue({
      tag: 'v1.0.0',
      name: 'v1.0.0',
      publishedAt: null,
    });

    const subscriber = new SubscriptionConfirmedSubscriber(
      monitoredRepoRepository,
      transactionManager,
      githubClient,
    );

    await subscriber.handle(event);

    expect(githubClient.getLatestRelease).toHaveBeenCalledWith('owner', 'repo');
    expect(monitoredRepoRepository.findByRepo).toHaveBeenCalledWith(
      RepoPath.fromString('owner/repo'),
      expect.anything(),
    );
    expect(monitoredRepoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: RepoPath.fromString('owner/repo'),
        watchers: [
          expect.objectContaining({
            subscriptionId: 'sub-1',
            lastNotifiedTag: ReleaseTag.fromString('v1.0.0'),
          }),
        ],
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

    const monitoredRepoRepository = mock<MonitoredRepoRepository>();
    monitoredRepoRepository.findByRepo.mockResolvedValue(existing);

    const transactionManager = mock<TransactionManager>();
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );

    const githubClient = mock<GithubClient>();
    githubClient.getLatestRelease.mockResolvedValue({
      tag: 'v1.0.0',
      name: 'v1.0.0',
      publishedAt: null,
    });

    const subscriber = new SubscriptionConfirmedSubscriber(
      monitoredRepoRepository,
      transactionManager,
      githubClient,
    );

    await subscriber.handle(event);

    expect(monitoredRepoRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        watchers: expect.arrayContaining([
          expect.objectContaining({ subscriptionId: 'sub-0' }),
          expect.objectContaining({ subscriptionId: 'sub-1' }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('stores null lastNotifiedTag when the repository has no releases', async () => {
    const monitoredRepoRepository = mock<MonitoredRepoRepository>();
    monitoredRepoRepository.findByRepo.mockResolvedValue(null);

    const transactionManager = mock<TransactionManager>();
    transactionManager.run.mockImplementation(async (work) =>
      work({} as never),
    );

    const githubClient = mock<GithubClient>();
    githubClient.getLatestRelease.mockResolvedValue(null);

    const subscriber = new SubscriptionConfirmedSubscriber(
      monitoredRepoRepository,
      transactionManager,
      githubClient,
    );

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
});
