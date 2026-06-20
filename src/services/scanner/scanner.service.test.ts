import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScannerService } from './scanner.service.js';
import type { SubscriptionService } from '../../domain/subscription.js';
import type { GithubClient } from '../../domain/github.js';
import type { NotificationService } from '../../domain/notification.js';
import type { Logger } from '../../domain/logger.js';
import { GithubRateLimitError } from '../../domain/errors.js';
import { mock } from 'vitest-mock-extended';
import type { Metrics } from '../../domain/metrics.js';
import { Subscription as DomainSubscription } from '../../domain/subscription/subscription.js';
import { Email } from '../../domain/subscription/email.js';
import { RepoPath } from '../../domain/subscription/repo-path.js';
import { ReleaseTag } from '../../domain/subscription/release-tag.js';
import { ConfirmationToken } from '../../domain/subscription/confirmation-token.js';

const UNSUBSCRIBE_TOKEN = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const createConfirmedDomainSubscription = (overrides: {
  id?: string;
  email?: string;
  repo?: string;
  lastSeenTag?: string | null;
}) => {
  const subscription = DomainSubscription.request(
    overrides.id ?? '1',
    Email.fromString(overrides.email ?? 'test@example.com'),
    RepoPath.fromString(overrides.repo ?? 'owner/repo'),
    ConfirmationToken.hydrate({
      value: '550e8400-e29b-41d4-a716-446655440000',
      scope: 'subscribe',
      expiresAt: new Date(Date.now() + 60_000),
    }),
  );

  subscription.confirm(
    '550e8400-e29b-41d4-a716-446655440000',
    new Date(),
    ConfirmationToken.hydrate({
      value: UNSUBSCRIBE_TOKEN,
      scope: 'unsubscribe',
      expiresAt: new Date(Date.now() + 60_000),
    }),
  );

  if (overrides.lastSeenTag) {
    subscription.observeRelease(ReleaseTag.fromString(overrides.lastSeenTag));
  }

  return subscription;
};

describe('ScannerService', () => {
  let scannerService: ScannerService;
  const subscriptionServiceMock = mock<SubscriptionService>();
  const githubClientMock = mock<GithubClient>();
  const notificationServiceMock = mock<NotificationService>();
  const loggerMock = mock<Logger>();
  const metricsMock = mock<Metrics>();

  beforeEach(() => {
    vi.resetAllMocks();

    scannerService = new ScannerService(
      subscriptionServiceMock,
      githubClientMock,
      notificationServiceMock,
      loggerMock,
      metricsMock,
    );
  });

  describe('scan', () => {
    it('should notify and update tag when a new release is found', async () => {
      const sub = createConfirmedDomainSubscription({
        lastSeenTag: 'v1.0.0',
      });

      const latestRelease = {
        tag: 'v1.1.0',
        name: 'New Release',
        publishedAt: new Date().toISOString(),
      };

      subscriptionServiceMock.findAllConfirmedSubscriptions.mockResolvedValue([
        sub,
      ]);
      githubClientMock.getLatestRelease.mockResolvedValue(latestRelease);

      await scannerService.scan();

      expect(notificationServiceMock.notifyNewRelease).toHaveBeenCalledWith({
        email: sub.email.email,
        repo: sub.repoPath.toString(),
        tag: latestRelease.tag,
        releaseName: latestRelease.name,
        unsubscribeToken: UNSUBSCRIBE_TOKEN,
      });
      expect(subscriptionServiceMock.observeNewRelease).toHaveBeenCalledWith(
        '1',
        'v1.1.0',
      );
    });

    it('should continue scanning other subscriptions when one fails', async () => {
      const sub1 = createConfirmedDomainSubscription({
        id: '1',
        email: 'fail@example.com',
        repo: 'owner/fail',
      });
      const sub2 = createConfirmedDomainSubscription({
        id: '2',
        email: 'ok@example.com',
        repo: 'owner/ok',
      });

      const latestRelease = {
        tag: 'v1.0.0',
        name: 'Release',
        publishedAt: new Date().toISOString(),
      };

      subscriptionServiceMock.findAllConfirmedSubscriptions.mockResolvedValue([
        sub1,
        sub2,
      ]);
      githubClientMock.getLatestRelease
        .mockRejectedValueOnce(new Error('GitHub unavailable'))
        .mockResolvedValueOnce(latestRelease);

      await scannerService.scan();

      expect(loggerMock.error).toHaveBeenCalledWith(
        'Error scanning subscription',
        expect.any(Error),
        { repo: 'owner/fail', subscriptionId: '1' },
      );
      expect(notificationServiceMock.notifyNewRelease).toHaveBeenCalledWith({
        email: sub2.email.email,
        repo: sub2.repoPath.toString(),
        tag: latestRelease.tag,
        releaseName: latestRelease.name,
        unsubscribeToken: UNSUBSCRIBE_TOKEN,
      });
    });

    it('should not notify when the latest release tag is unchanged', async () => {
      const sub = createConfirmedDomainSubscription({
        lastSeenTag: 'v1.0.0',
      });

      subscriptionServiceMock.findAllConfirmedSubscriptions.mockResolvedValue([
        sub,
      ]);
      githubClientMock.getLatestRelease.mockResolvedValue({
        tag: 'v1.0.0',
        name: 'Same Release',
        publishedAt: new Date().toISOString(),
      });

      await scannerService.scan();

      expect(notificationServiceMock.notifyNewRelease).not.toHaveBeenCalled();
      expect(subscriptionServiceMock.observeNewRelease).not.toHaveBeenCalled();
    });

    it('should stop scanning if rate limit is exceeded', async () => {
      const sub = createConfirmedDomainSubscription({
        id: '1',
        email: 'user1@example.com',
        repo: 'owner/repo1',
        lastSeenTag: 'v1.0.0',
      });

      subscriptionServiceMock.findAllConfirmedSubscriptions.mockResolvedValue([
        sub,
      ]);
      githubClientMock.getLatestRelease.mockRejectedValueOnce(
        new GithubRateLimitError(),
      );

      await expect(scannerService.scan()).rejects.toThrow(GithubRateLimitError);

      expect(loggerMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('rate limit exceeded'),
      );
    });
  });
});
