import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';
import { ScannerEventType } from '../../../scanner/api/events.js';
import { NewReleaseDetectedSubscriber } from './new-release-detected.subscriber.js';

describe('NewReleaseDetectedSubscriber', () => {
  it('sends a new release notification email', async () => {
    const emailClient = mock<EmailClient>();
    const metrics = mock<NotificationMetrics>();
    const subscriber = new NewReleaseDetectedSubscriber(
      emailClient,
      'http://localhost:3000',
      metrics,
    );

    await subscriber.handle({
      type: ScannerEventType.NewReleaseDetected,
      aggregateId: 'sub-1',
      occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      payload: {
        email: 'test@example.com',
        repo: 'owner/repo',
        tag: 'v1.1.0',
        releaseName: 'Release 1.1',
        unsubscribeToken: 'unsub-token',
      },
    });

    expect(emailClient.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('owner/repo'),
        text: expect.stringContaining('v1.1.0'),
      }),
    );
    expect(metrics.incrementNotificationsSent).toHaveBeenCalled();
  });
});
