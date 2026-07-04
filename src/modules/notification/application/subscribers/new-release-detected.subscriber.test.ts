import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Email } from '../../domain/index.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';
import { ScannerEventType } from '../../../scanner/api/events.js';
import { RecipientNotFoundError } from '../errors.js';
import { Recipient } from '../../domain/recipient.js';
import { NewReleaseDetectedSubscriber } from './new-release-detected.subscriber.js';

describe('NewReleaseDetectedSubscriber', () => {
  it('sends a new release notification email', async () => {
    const recipientRepository = mock<RecipientRepository>();
    const recipient = Recipient.rehydrate({
      subscriptionId: 'sub-1',
      email: Email.fromString('test@example.com'),
      unsubscribeToken: 'unsub-token',
    });
    recipientRepository.findBySubscriptionId.mockResolvedValue(recipient);

    const emailClient = mock<EmailClient>();
    const metrics = mock<NotificationMetrics>();
    const subscriber = new NewReleaseDetectedSubscriber(
      recipientRepository,
      emailClient,
      'http://localhost:3000',
      metrics,
    );

    await subscriber.handle({
      type: ScannerEventType.NewReleaseDetected,
      aggregateId: 'sub-1',
      occurredAt: '2024-01-01T00:00:00.000Z',
      payload: {
        repo: 'owner/repo',
        tag: 'v1.1.0',
        releaseName: 'Release 1.1',
      },
    });

    expect(recipientRepository.findBySubscriptionId).toHaveBeenCalledWith(
      'sub-1',
    );
    expect(emailClient.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: expect.stringContaining('owner/repo'),
        text: expect.stringContaining('v1.1.0'),
      }),
    );
    expect(metrics.incrementNotificationsSent).toHaveBeenCalled();
  });

  it('throws RecipientNotFoundError when recipient does not exist', async () => {
    const metrics = mock<NotificationMetrics>();
    const recipientRepository = mock<RecipientRepository>();
    recipientRepository.findBySubscriptionId.mockResolvedValue(null);

    const emailClient = mock<EmailClient>();
    const subscriber = new NewReleaseDetectedSubscriber(
      recipientRepository,
      emailClient,
      'http://localhost:3000',
      metrics,
    );

    await expect(
      subscriber.handle({
        type: ScannerEventType.NewReleaseDetected,
        aggregateId: 'sub-missing',
        occurredAt: '2024-01-01T00:00:00.000Z',
        payload: {
          repo: 'owner/repo',
          tag: 'v1.1.0',
          releaseName: 'Release 1.1',
        },
      }),
    ).rejects.toThrow(RecipientNotFoundError);

    expect(recipientRepository.findBySubscriptionId).toHaveBeenCalledWith(
      'sub-missing',
    );
    expect(emailClient.sendEmail).not.toHaveBeenCalled();
  });
});
