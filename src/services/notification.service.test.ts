import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from './notification.service.js';
import type { EmailService } from '../domain/email.js';
import type { SubscriptionTokenManager } from '../domain/subscription-token-manager.js';
import type { Subscription } from '../domain/subscription.js';
import type { GithubRelease } from '../domain/github.js';
import { TokenNotFoundError } from '../domain/errors.js';
import { mock } from 'vitest-mock-extended';
import type { Metrics } from '../domain/metrics.js';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  const emailServiceMock = mock<EmailService>();
  const tokenManagerMock = mock<SubscriptionTokenManager>();
  const appUrl = 'http://localhost:3000';
  const metricsMock = mock<Metrics>();

  beforeEach(() => {
    vi.resetAllMocks();

    notificationService = new NotificationService(
      emailServiceMock,
      tokenManagerMock,
      appUrl,
      metricsMock,
    );
  });

  it('should send email with unsubscribe link', async () => {
    const subscription: Subscription = {
      id: 1,
      email: 'user@example.com',
      repo: 'owner/repo',
      confirmed: true,
      lastSeenTag: 'v1.0.0',
      createdAt: new Date(),
    };

    const release: GithubRelease = {
      tag: 'v1.1.0',
      name: 'Release 1.1.0',
      publishedAt: '2026-04-11T12:00:00Z',
    };

    tokenManagerMock.getTokenBySubscriptionIdAndScope.mockResolvedValue({
      id: 1,
      token: 'unsub-token',
      subscriptionId: 1,
      scope: 'unsubscribe',
      expiresAt: new Date(),
      createdAt: new Date(),
    });

    await notificationService.notifyNewRelease(subscription, release);

    expect(emailServiceMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: subscription.email,
        subject: expect.stringContaining(subscription.repo),
        text: expect.stringContaining(`${appUrl}/unsubscribe/unsub-token`),
      }),
    );
  });

  it('should throw TokenNotFoundError if unsubscribe token is missing', async () => {
    const subscription: Subscription = {
      id: 1,
      email: 'user@example.com',
      repo: 'owner/repo',
      confirmed: true,
      lastSeenTag: 'v1.0.0',
      createdAt: new Date(),
    };

    const release: GithubRelease = {
      tag: 'v1.1.0',
      name: 'Release 1.1.0',
      publishedAt: '2026-04-11T12:00:00Z',
    };

    tokenManagerMock.getTokenBySubscriptionIdAndScope.mockResolvedValue(null);

    await expect(
      notificationService.notifyNewRelease(subscription, release),
    ).rejects.toThrow(TokenNotFoundError);
  });
});
