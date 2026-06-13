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
      githubClientMock.getLatestRelease.mockResolvedValue(latestRelease);

      await scannerService.scan();

      expect(notificationServiceMock.notifyNewRelease).toHaveBeenCalledWith(
        sub,
        latestRelease,
      );
      expect(repoMock.updateLastSeenTag).toHaveBeenCalledWith(1, 'v1.1.0');
    });

    it('should continue scanning other subscriptions when one fails', async () => {
      const sub1: Subscription = {
        id: 1,
        email: 'fail@example.com',
        repo: 'owner/fail',
        confirmed: true,
        lastSeenTag: null,
        createdAt: new Date(),
      };
      const sub2: Subscription = {
        id: 2,
        email: 'ok@example.com',
        repo: 'owner/ok',
        confirmed: true,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      const latestRelease = {
        tag: 'v1.0.0',
        name: 'Release',
        publishedAt: new Date().toISOString(),
      };

      repoMock.findAllConfirmedSubscriptions.mockResolvedValue([sub1, sub2]);
      githubClientMock.getLatestRelease
        .mockRejectedValueOnce(new Error('GitHub unavailable'))
        .mockResolvedValueOnce(latestRelease);

      await scannerService.scan();

      expect(loggerMock.error).toHaveBeenCalledWith(
        'Error scanning owner/fail:',
        expect.any(Error),
      );
      expect(notificationServiceMock.notifyNewRelease).toHaveBeenCalledWith(
        sub2,
        latestRelease,
      );
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
      githubClientMock.getLatestRelease.mockRejectedValueOnce(
        new GithubRateLimitError(),
      );

      await expect(scannerService.scan()).rejects.toThrow(GithubRateLimitError);

      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('rate limit exceeded'),
      );
    });
  });

  describe('safeScanSubscription', () => {
    it('should log and swallow non-rate-limit errors', async () => {
      const sub: Subscription = {
        id: 1,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      githubClientMock.getLatestRelease.mockRejectedValue(
        new Error('GitHub unavailable'),
      );

      await scannerService.safeScanSubscription(sub);

      expect(loggerMock.error).toHaveBeenCalledWith(
        'Error scanning owner/repo:',
        expect.any(Error),
      );
    });

    it('should rethrow rate limit errors', async () => {
      const sub: Subscription = {
        id: 1,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      githubClientMock.getLatestRelease.mockRejectedValue(
        new GithubRateLimitError(),
      );

      await expect(scannerService.safeScanSubscription(sub)).rejects.toThrow(
        GithubRateLimitError,
      );
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

      githubClientMock.getLatestRelease.mockResolvedValue(latestRelease);

      await scannerService.scanSubscription(sub);

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

      githubClientMock.getLatestRelease.mockResolvedValue({
        tag: 'v1.0.0',
        name: 'Same Release',
        publishedAt: new Date().toISOString(),
      });

      await scannerService.scanSubscription(sub);

      expect(notificationServiceMock.notifyNewRelease).not.toHaveBeenCalled();
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

      githubClientMock.getLatestRelease.mockRejectedValue(
        new GithubRateLimitError(),
      );

      await expect(scannerService.scanSubscription(sub)).rejects.toThrow(
        GithubRateLimitError,
      );
    });
  });
});
