import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScannerService } from './scanner.service.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import type { GithubClient } from '../domain/github.js';
import type { Subscription } from '../domain/subscription.js';
import { NotificationService } from './notification.service.js';
import type { Logger } from '../domain/logger.js';
import { GithubRateLimitError } from '../domain/errors.js';
import { mock } from 'vitest-mock-extended';
import type { Metrics } from '../domain/metrics.js';

describe('ScannerService', () => {
  let scannerService: ScannerService;
  const repoMock = mock<SubscriptionRepository>();
  const githubClientMock = mock<GithubClient>();
  const notificationServiceMock = mock<NotificationService>();
  const loggerMock = mock<Logger>();
  const metricsMock = mock<Metrics>();

  beforeEach(() => {
    vi.resetAllMocks();

    scannerService = new ScannerService(
      repoMock,
      githubClientMock,
      notificationServiceMock,
      loggerMock,
      metricsMock,
    );
  });

  describe('scan', () => {
    it('should notify and update tag when a new release is found', async () => {
      const sub: Subscription = {
        id: 1,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: 'v1.0.0',
        createdAt: new Date(),
      };

      const latestRelease = {
        tag: 'v1.1.0',
        name: 'New Release',
        publishedAt: new Date().toISOString(),
      };

      repoMock.findAllConfirmedSubscriptions.mockResolvedValue([sub]);
      repoMock.findSubscriptionById.mockResolvedValue(sub);
      githubClientMock.getLatestRelease.mockResolvedValue(latestRelease);

      await scannerService.scan();

      expect(notificationServiceMock.notifyNewRelease).toHaveBeenCalledWith(
        sub,
        latestRelease,
      );
      expect(repoMock.updateLastSeenTag).toHaveBeenCalledWith(1, 'v1.1.0');
    });

    it('should stop scanning if rate limit is exceeded', async () => {
      const sub: Subscription = {
        id: 1,
        email: 'user1@example.com',
        repo: 'owner/repo1',
        confirmed: true,
        lastSeenTag: 'v1.0.0',
        createdAt: new Date(),
      };

      repoMock.findAllConfirmedSubscriptions.mockResolvedValue([sub]);
      repoMock.findSubscriptionById.mockResolvedValue(sub);
      githubClientMock.getLatestRelease.mockRejectedValueOnce(
        new GithubRateLimitError(),
      );

      await expect(scannerService.scan()).rejects.toThrow(GithubRateLimitError);

      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('rate limit exceeded'),
      );
    });
  });

  describe('scanSubscription', () => {
    it('should scan a single subscription and notify if new release', async () => {
      const sub: Subscription = {
        id: 1,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      const latestRelease = {
        tag: 'v1.0.0',
        name: 'First Release',
        publishedAt: new Date().toISOString(),
      };

      repoMock.findSubscriptionById.mockResolvedValue(sub);
      githubClientMock.getLatestRelease.mockResolvedValue(latestRelease);

      await scannerService.scanSubscription(1);

      expect(notificationServiceMock.notifyNewRelease).toHaveBeenCalledWith(
        sub,
        latestRelease,
      );
      expect(repoMock.updateLastSeenTag).toHaveBeenCalledWith(1, 'v1.0.0');
    });

    it('should not notify if tag is the same', async () => {
      const sub: Subscription = {
        id: 1,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: 'v1.0.0',
        createdAt: new Date(),
      };

      repoMock.findSubscriptionById.mockResolvedValue(sub);
      githubClientMock.getLatestRelease.mockResolvedValue({
        tag: 'v1.0.0',
        name: 'Same Release',
        publishedAt: new Date().toISOString(),
      });

      await scannerService.scanSubscription(1);

      expect(notificationServiceMock.notifyNewRelease).not.toHaveBeenCalled();
    });

    it('should do nothing if subscription is not confirmed', async () => {
      const sub: Subscription = {
        id: 1,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: false,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      repoMock.findSubscriptionById.mockResolvedValue(sub);

      await scannerService.scanSubscription(1);

      expect(githubClientMock.getLatestRelease).not.toHaveBeenCalled();
      expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('should throw if rate limit is exceeded', async () => {
      const sub: Subscription = {
        id: 1,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      repoMock.findSubscriptionById.mockResolvedValue(sub);
      githubClientMock.getLatestRelease.mockRejectedValue(
        new GithubRateLimitError(),
      );

      await expect(scannerService.scanSubscription(1)).rejects.toThrow(
        GithubRateLimitError,
      );
    });
  });
});
