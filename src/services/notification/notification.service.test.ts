import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotificationService,
  type NewReleaseNotificationContext,
} from './notification.service.js';
import type { EmailService } from '../../domain/email.js';
import { mock } from 'vitest-mock-extended';
import type { Metrics } from '../../domain/metrics.js';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  const emailServiceMock = mock<EmailService>();
  const appUrl = 'http://localhost:3000';
  const metricsMock = mock<Metrics>();

  beforeEach(() => {
    vi.resetAllMocks();

    notificationService = new NotificationService(
      emailServiceMock,
      appUrl,
      metricsMock,
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

    expect(emailServiceMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: context.email,
        subject: expect.stringContaining(context.repo),
        text: expect.stringContaining(`${appUrl}/unsubscribe/unsub-token`),
      }),
    );
    expect(metricsMock.incrementNotificationsSent).toHaveBeenCalledWith(
      context.repo,
    );
  });
});
