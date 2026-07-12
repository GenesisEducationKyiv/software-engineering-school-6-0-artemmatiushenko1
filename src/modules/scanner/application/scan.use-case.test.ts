import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScanUseCase } from './scan.use-case.js';
import type { MonitoredRepoRepository } from './ports/monitored-repo.repository.js';
import type { TransactionManager } from '../../../shared-kernel/transaction.js';
import type { GithubClient } from '../../github/api/github-client.interface.js';
import type { Logger } from '../../../shared-kernel/logger.js';
import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';
import type { Clock } from '../../../shared-kernel/clock.js';
import { GithubRateLimitError } from '../../github/domain/errors.js';
import { ScannerEventType } from '../api/events.js';
import { mock } from 'vitest-mock-extended';
import type { ScannerMetrics } from './ports/scanner-metrics.interface.js';
import {
  MonitoredRepo,
  ReleaseTag,
  RepoPath,
  RepoWatcher,
} from '../domain/index.js';

const FIXED_NOW = new Date('2026-01-01T12:00:00Z');
const FIXED_NOW_ISO = FIXED_NOW.toISOString();

const createWatcher = (
  subscriptionId: string,
  lastNotifiedTag: string | null = null,
) =>
  RepoWatcher.create({
    subscriptionId,
    lastNotifiedTag: lastNotifiedTag
      ? ReleaseTag.fromString(lastNotifiedTag)
      : null,
  });

const createMonitoredRepo = (options: {
  repo?: string;
  lastSeenTag?: string | null;
  watchers?: Array<{
    subscriptionId: string;
    lastNotifiedTag?: string | null;
  }>;
}) => {
  const monitoredRepo = MonitoredRepo.create(
    RepoPath.fromString(options.repo ?? 'owner/repo'),
  );

  for (const watcher of options.watchers ?? [
    {
      subscriptionId: '1',
      lastNotifiedTag: options.lastSeenTag ?? null,
    },
  ]) {
    monitoredRepo.addWatcher(
      createWatcher(watcher.subscriptionId, watcher.lastNotifiedTag ?? null),
    );
  }

  if (options.lastSeenTag) {
    monitoredRepo.markReleaseSeen(ReleaseTag.fromString(options.lastSeenTag));
  }

  return monitoredRepo;
};

describe('ScanUseCase', () => {
  let scanUseCase: ScanUseCase;
  const monitoredRepoRepositoryMock = mock<MonitoredRepoRepository>();
  const transactionManagerMock = mock<TransactionManager>();
  const githubClientMock = mock<GithubClient>();
  const loggerMock = mock<Logger>();
  const clockMock = mock<Clock>();
  const metricsMock = mock<ScannerMetrics>();
  const eventBusMock = mock<EventBus>();

  beforeEach(() => {
    vi.resetAllMocks();

    clockMock.now.mockReturnValue(FIXED_NOW);
    eventBusMock.publish.mockResolvedValue(undefined);
    transactionManagerMock.run.mockImplementation(async (work) =>
      work({} as never),
    );

    scanUseCase = new ScanUseCase(
      monitoredRepoRepositoryMock,
      transactionManagerMock,
      githubClientMock,
      loggerMock,
      clockMock,
      metricsMock,
      eventBusMock,
    );
  });

  describe('execute', () => {
    it('should notify and update watcher tag when a new release is found', async () => {
      const monitoredRepo = createMonitoredRepo({
        lastSeenTag: 'v1.0.0',
        watchers: [
          {
            subscriptionId: '1',
            lastNotifiedTag: 'v1.0.0',
          },
        ],
      });

      const latestRelease = {
        tag: 'v1.1.0',
        name: 'New Release',
        publishedAt: new Date().toISOString(),
      };

      monitoredRepoRepositoryMock.findAll.mockResolvedValue([monitoredRepo]);
      githubClientMock.getLatestRelease.mockResolvedValue(latestRelease);

      await scanUseCase.execute();

      expect(eventBusMock.publish).toHaveBeenCalledWith([
        {
          type: ScannerEventType.NewReleaseDetected,
          aggregateId: '1',
          occurredAt: FIXED_NOW_ISO,
          payload: {
            repo: 'owner/repo',
            tag: latestRelease.tag,
            releaseName: latestRelease.name,
          },
        },
      ]);
      expect(monitoredRepoRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSeenTag: ReleaseTag.fromString('v1.1.0'),
          watchers: [
            expect.objectContaining({
              subscriptionId: '1',
              lastNotifiedTag: ReleaseTag.fromString('v1.1.0'),
            }),
          ],
        }),
        expect.anything(),
      );
    });

    it('should continue scanning other repos when one fails', async () => {
      const failingRepo = createMonitoredRepo({
        repo: 'owner/fail',
        watchers: [{ subscriptionId: '1' }],
      });
      const okRepo = createMonitoredRepo({
        repo: 'owner/ok',
        watchers: [{ subscriptionId: '2' }],
      });

      const latestRelease = {
        tag: 'v1.0.0',
        name: 'Release',
        publishedAt: new Date().toISOString(),
      };

      monitoredRepoRepositoryMock.findAll.mockResolvedValue([
        failingRepo,
        okRepo,
      ]);
      githubClientMock.getLatestRelease
        .mockRejectedValueOnce(new Error('GitHub unavailable'))
        .mockResolvedValueOnce(latestRelease);

      await scanUseCase.execute();

      expect(eventBusMock.publish).toHaveBeenCalledWith([
        {
          type: ScannerEventType.NewReleaseDetected,
          aggregateId: '2',
          occurredAt: FIXED_NOW_ISO,
          payload: {
            repo: 'owner/ok',
            tag: latestRelease.tag,
            releaseName: latestRelease.name,
          },
        },
      ]);
    });

    it('should not notify when the latest release tag is unchanged', async () => {
      const monitoredRepo = createMonitoredRepo({
        lastSeenTag: 'v1.0.0',
        watchers: [
          {
            subscriptionId: '1',
            lastNotifiedTag: 'v1.0.0',
          },
        ],
      });

      monitoredRepoRepositoryMock.findAll.mockResolvedValue([monitoredRepo]);
      githubClientMock.getLatestRelease.mockResolvedValue({
        tag: 'v1.0.0',
        name: 'Same Release',
        publishedAt: new Date().toISOString(),
      });

      await scanUseCase.execute();

      expect(eventBusMock.publish).not.toHaveBeenCalled();
      expect(monitoredRepoRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('should skip watchers already notified for the latest tag', async () => {
      const monitoredRepo = createMonitoredRepo({
        lastSeenTag: null,
        watchers: [
          {
            subscriptionId: '1',
            lastNotifiedTag: 'v1.0.0',
          },
          {
            subscriptionId: '2',
            lastNotifiedTag: 'v0.9.0',
          },
        ],
      });

      monitoredRepoRepositoryMock.findAll.mockResolvedValue([monitoredRepo]);
      githubClientMock.getLatestRelease.mockResolvedValue({
        tag: 'v1.0.0',
        name: 'Current Release',
        publishedAt: new Date().toISOString(),
      });

      await scanUseCase.execute();

      expect(eventBusMock.publish).toHaveBeenCalledTimes(1);
      expect(eventBusMock.publish).toHaveBeenCalledWith([
        expect.objectContaining({
          aggregateId: '2',
        }),
      ]);
    });

    it('should advance repo cursor without notifying when all watchers are already acked', async () => {
      const monitoredRepo = createMonitoredRepo({
        lastSeenTag: null,
        watchers: [
          {
            subscriptionId: '1',
            lastNotifiedTag: 'v1.0.0',
          },
        ],
      });

      monitoredRepoRepositoryMock.findAll.mockResolvedValue([monitoredRepo]);
      githubClientMock.getLatestRelease.mockResolvedValue({
        tag: 'v1.0.0',
        name: 'Current Release',
        publishedAt: new Date().toISOString(),
      });

      await scanUseCase.execute();

      expect(eventBusMock.publish).not.toHaveBeenCalled();
      expect(monitoredRepoRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSeenTag: ReleaseTag.fromString('v1.0.0'),
        }),
        expect.anything(),
      );
    });

    it('should notify multiple watchers for the same repo with one GitHub call', async () => {
      const monitoredRepo = createMonitoredRepo({
        lastSeenTag: 'v1.0.0',
        watchers: [
          {
            subscriptionId: '1',
            lastNotifiedTag: 'v1.0.0',
          },
          {
            subscriptionId: '2',
            lastNotifiedTag: 'v1.0.0',
          },
        ],
      });

      monitoredRepoRepositoryMock.findAll.mockResolvedValue([monitoredRepo]);
      githubClientMock.getLatestRelease.mockResolvedValue({
        tag: 'v1.1.0',
        name: 'New Release',
        publishedAt: new Date().toISOString(),
      });

      await scanUseCase.execute();

      expect(githubClientMock.getLatestRelease).toHaveBeenCalledTimes(1);
      expect(eventBusMock.publish).toHaveBeenCalledTimes(1);
      expect(eventBusMock.publish).toHaveBeenCalledWith([
        expect.objectContaining({ aggregateId: '1' }),
        expect.objectContaining({ aggregateId: '2' }),
      ]);
    });

    it('should stop scanning if rate limit is exceeded', async () => {
      const monitoredRepo = createMonitoredRepo({
        repo: 'owner/repo1',
        lastSeenTag: 'v1.0.0',
      });

      monitoredRepoRepositoryMock.findAll.mockResolvedValue([monitoredRepo]);
      githubClientMock.getLatestRelease.mockRejectedValueOnce(
        new GithubRateLimitError(),
      );

      await expect(scanUseCase.execute()).rejects.toThrow(GithubRateLimitError);

      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('rate limit exceeded'),
      );
    });
  });
});
