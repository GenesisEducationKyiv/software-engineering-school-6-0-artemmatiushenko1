import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScanUseCase } from './scan.use-case.js';
import type { SubscriptionQueries } from '../../subscription/api/subscription-queries.interface.js';
import type { GithubClient } from '../../github/api/github-client.interface.js';
import type { NotificationService } from '../../notification/api/notification.service.js';
import type { Logger } from '../../../shared-kernel/logger.js';
import type { Clock } from '../../../shared-kernel/index.js';
import { GithubRateLimitError } from '../../github/domain/errors.js';
import { mock } from 'vitest-mock-extended';
import type { ScannerMetrics } from '../scanner-metrics.interface.js';
import { Subscription } from '../../subscription/domain/index.js';
import { SubscriptionTokenScope } from '../../subscription/domain/subscription-token-scope.js';
import { Email } from '../../subscription/domain/email.js';
import { RepoPath } from '../../subscription/domain/repo-path.js';
import { ReleaseTag } from '../../subscription/domain/release-tag.js';
import { SubscriptionToken } from '../../subscription/domain/subscription-token.js';

const UNSUBSCRIBE_TOKEN = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const FIXED_NOW = new Date('2026-01-01T12:00:00Z');
const TOKEN_EXPIRES_AT = new Date('2026-01-01T13:00:00Z');

const createConfirmedDomainSubscription = (overrides: {
  id?: string;
  email?: string;
  repo?: string;
  lastSeenTag?: string | null;
}) => {
  const subscription = Subscription.request(
    overrides.id ?? '1',
    Email.fromString(overrides.email ?? 'test@example.com'),
    RepoPath.fromString(overrides.repo ?? 'owner/repo'),
    SubscriptionToken.rehydrate({
      value: '550e8400-e29b-41d4-a716-446655440000',
      scope: SubscriptionTokenScope.Confirm,
      expiresAt: TOKEN_EXPIRES_AT,
    }),
  );

  subscription.confirm(
    '550e8400-e29b-41d4-a716-446655440000',
    FIXED_NOW,
    SubscriptionToken.rehydrate({
      value: UNSUBSCRIBE_TOKEN,
      scope: SubscriptionTokenScope.Unsubscribe,
      expiresAt: TOKEN_EXPIRES_AT,
    }),
  );

  if (overrides.lastSeenTag) {
    subscription.observeRelease(ReleaseTag.fromString(overrides.lastSeenTag));
  }

  return subscription;
};

describe('ScanUseCase', () => {
  let scanUseCase: ScanUseCase;
  const subscriptionQueriesMock = mock<SubscriptionQueries>();
  const githubClientMock = mock<GithubClient>();
  const notificationServiceMock = mock<NotificationService>();
  const loggerMock = mock<Logger>();
  const clockMock = mock<Clock>();
  const metricsMock = mock<ScannerMetrics>();

  beforeEach(() => {
    vi.resetAllMocks();

    clockMock.now.mockReturnValue(FIXED_NOW);

    scanUseCase = new ScanUseCase(
      subscriptionQueriesMock,
      githubClientMock,
      notificationServiceMock,
      loggerMock,
      clockMock,
      metricsMock,
    );
  });

  describe('execute', () => {
    it('should notify and update tag when a new release is found', async () => {
      const sub = createConfirmedDomainSubscription({
        lastSeenTag: 'v1.0.0',
      });

      const latestRelease = {
        tag: 'v1.1.0',
        name: 'New Release',
        publishedAt: new Date().toISOString(),
      };

      subscriptionQueriesMock.findAllConfirmedSubscriptions.mockResolvedValue([
        sub,
      ]);
      githubClientMock.getLatestRelease.mockResolvedValue(latestRelease);

      await scanUseCase.execute();

      expect(notificationServiceMock.notifyNewRelease).toHaveBeenCalledWith({
        email: sub.email.value,
        repo: sub.repoPath.toString(),
        tag: latestRelease.tag,
        releaseName: latestRelease.name,
        unsubscribeToken: UNSUBSCRIBE_TOKEN,
      });
      expect(subscriptionQueriesMock.observeNewRelease).toHaveBeenCalledWith(
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

      subscriptionQueriesMock.findAllConfirmedSubscriptions.mockResolvedValue([
        sub1,
        sub2,
      ]);
      githubClientMock.getLatestRelease
        .mockRejectedValueOnce(new Error('GitHub unavailable'))
        .mockResolvedValueOnce(latestRelease);

      await scanUseCase.execute();

      expect(notificationServiceMock.notifyNewRelease).toHaveBeenCalledWith({
        email: sub2.email.value,
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

      subscriptionQueriesMock.findAllConfirmedSubscriptions.mockResolvedValue([
        sub,
      ]);
      githubClientMock.getLatestRelease.mockResolvedValue({
        tag: 'v1.0.0',
        name: 'Same Release',
        publishedAt: new Date().toISOString(),
      });

      await scanUseCase.execute();

      expect(notificationServiceMock.notifyNewRelease).not.toHaveBeenCalled();
      expect(subscriptionQueriesMock.observeNewRelease).not.toHaveBeenCalled();
    });

    it('should stop scanning if rate limit is exceeded', async () => {
      const sub = createConfirmedDomainSubscription({
        id: '1',
        email: 'user1@example.com',
        repo: 'owner/repo1',
        lastSeenTag: 'v1.0.0',
      });

      subscriptionQueriesMock.findAllConfirmedSubscriptions.mockResolvedValue([
        sub,
      ]);
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
