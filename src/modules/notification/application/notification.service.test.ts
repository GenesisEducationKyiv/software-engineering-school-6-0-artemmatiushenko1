import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationServiceImpl } from './notification.service.js';
import type { NewReleaseNotificationContext } from '../api/notification.service.js';
import type { EmailClient } from './ports/email-client.js';
import { mock } from 'vitest-mock-extended';
import type { Metrics } from '../../../infrastructure/metrics/metrics.interface.js';

describe('NotificationServiceImpl', () => {
  let notificationService: NotificationServiceImpl;
  const emailClientMock = mock<EmailClient>();
  const appUrl = 'http://localhost:3000';
  const metricsMock = mock<Metrics>();

  beforeEach(() => {
    vi.resetAllMocks();

    notificationService = new NotificationServiceImpl(
      emailClientMock,
      appUrl,
      metricsMock,
    );
  });

  it('should send subscription confirmation email', async () => {
    const context = {
      email: 'user@example.com',
      repo: 'owner/repo',
      confirmToken: 'confirm-token',
    };

    await notificationService.notifySubscriptionConfirmation(context);

    expect(emailClientMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: context.email,
        subject: `Confirm subscription: ${context.repo}`,
        text: expect.stringContaining(
          `${appUrl}/confirm/${context.confirmToken}`,
        ),
      }),
    );
  });

  it('should send subscription confirmed email', async () => {
    const context = {
      email: 'user@example.com',
      repo: 'owner/repo',
      unsubscribeToken: 'unsub-token',
    };

    await notificationService.notifySubscriptionConfirmed(context);

    expect(emailClientMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: context.email,
        subject: expect.stringContaining(context.repo),
        text: expect.stringContaining(`${appUrl}/unsubscribe/unsub-token`),
      }),
    );
  });

  it('should send email with unsubscribe link', async () => {
    const context: NewReleaseNotificationContext = {
      email: 'user@example.com',
      repo: 'owner/repo',
      tag: 'v1.1.0',
      releaseName: 'Release 1.1.0',
      unsubscribeToken: 'unsub-token',
    };

    await notificationService.notifyNewRelease(context);

    expect(emailClientMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: context.email,
        subject: expect.stringContaining(context.repo),
        text: expect.stringContaining(`${appUrl}/unsubscribe/unsub-token`),
      }),
    );
    expect(metricsMock.incrementNotificationsSent).toHaveBeenCalled();
  });
});
