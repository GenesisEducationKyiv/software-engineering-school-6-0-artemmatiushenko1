import { describe, it, expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Email } from '../../domain/index.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';
import { ScannerEventType } from '../../../scanner/api/events.js';
import { Recipient } from '../../domain/recipient.js';
import { deliveryKey } from '../../../../platform/idempotency-guard/delivery-key.js';
import { NewReleaseDetectedSubscriber } from './new-release-detected.subscriber.js';

describe('NewReleaseDetectedSubscriber', () => {
  const event = {
    type: ScannerEventType.NewReleaseDetected,
    aggregateId: 'sub-1',
    occurredAt: new Date('2024-01-01T00:00:00.000Z'),
    messageId: 'msg-1',
    payload: {
      repo: 'owner/repo',
      tag: 'v1.1.0',
      releaseName: 'Release 1.1',
    },
  } as const;

  it('sends a new release notification email', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue({ release: vi.fn() });
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
      idempotencyGuard,
      recipientRepository,
      emailClient,
      'http://localhost:3000',
      metrics,
    );

    await subscriber.handle(event);

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

  it('does not send email on duplicate delivery', async () => {
    const idempotencyGuard = mock<IdempotencyGuard>();
    idempotencyGuard.claim.mockResolvedValue(null);
    const recipientRepository = mock<RecipientRepository>();
    const recipient = Recipient.rehydrate({
      subscriptionId: 'sub-1',
      email: Email.fromString('test@example.com'),
      unsubscribeToken: 'unsub-token',
    });
    recipientRepository.findBySubscriptionId.mockResolvedValue(recipient);

    const emailClient = mock<EmailClient>();
    const subscriber = new NewReleaseDetectedSubscriber(
      idempotencyGuard,
      recipientRepository,
      emailClient,
      'http://localhost:3000',
    );

    await subscriber.handle(event);

    expect(idempotencyGuard.claim).toHaveBeenCalledWith(
      deliveryKey('msg-1', 'notification:new-release-detected'),
    );
    expect(emailClient.sendEmail).not.toHaveBeenCalled();
  });
});
