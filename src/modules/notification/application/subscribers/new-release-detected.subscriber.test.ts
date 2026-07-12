import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Email } from '../../domain/index.js';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import type { IdempotencyGuard } from '../../../../platform/idempotency-guard/idempotency-guard.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';
import {
  ScannerEventType,
  type NewReleaseDetectedEvent,
} from '../../../scanner/api/events.js';
import { RecipientNotFoundError } from '../errors.js';
import { Recipient } from '../../domain/recipient.js';
import { NewReleaseDetectedSubscriber } from './new-release-detected.subscriber.js';

describe('NewReleaseDetectedSubscriber', () => {
  const event: Delivered<NewReleaseDetectedEvent> = {
    type: ScannerEventType.NewReleaseDetected,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    id: 'msg-1',
    payload: {
      repo: 'owner/repo',
      tag: 'v1.1.0',
      releaseName: 'Release 1.1',
    },
  };

  const idempotencyGuard = mock<IdempotencyGuard>();
  const recipientRepository = mock<RecipientRepository>();
  const emailClient = mock<EmailClient>();
  const metrics = mock<NotificationMetrics>();

  const recipient = Recipient.rehydrate({
    subscriptionId: 'sub-1',
    email: Email.fromString('test@example.com'),
    unsubscribeToken: 'unsub-token',
  });

  let subscriber: NewReleaseDetectedSubscriber;

  beforeEach(() => {
    vi.resetAllMocks();

    idempotencyGuard.isProcessed.mockResolvedValue(false);
    recipientRepository.findBySubscriptionId.mockResolvedValue(recipient);

    subscriber = new NewReleaseDetectedSubscriber(
      idempotencyGuard,
      recipientRepository,
      emailClient,
      'http://localhost:3000',
      metrics,
    );
  });

  it('sends a new release notification email', async () => {
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
    idempotencyGuard.isProcessed.mockResolvedValue(true);

    await subscriber.handle(event);

    expect(idempotencyGuard.isProcessed).toHaveBeenCalledWith(
      'msg-1:notification:new-release-detected',
    );
    expect(emailClient.sendEmail).not.toHaveBeenCalled();
  });

  it('throws RecipientNotFoundError when recipient does not exist', async () => {
    recipientRepository.findBySubscriptionId.mockResolvedValue(null);

    await expect(
      subscriber.handle({
        ...event,
        aggregateId: 'sub-missing',
        id: 'msg-2',
      }),
    ).rejects.toThrow(RecipientNotFoundError);

    expect(recipientRepository.findBySubscriptionId).toHaveBeenCalledWith(
      'sub-missing',
    );
    expect(emailClient.sendEmail).not.toHaveBeenCalled();
  });
});
