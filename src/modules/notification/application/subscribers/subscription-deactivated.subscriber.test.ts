import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Delivered } from '../../../../platform/event-bus/domain-event-envelope.js';
import {
  SubscriptionEventType,
  type SubscriptionDeactivatedEvent,
} from '../../../subscription/api/events.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';
import { SubscriptionDeactivatedSubscriber } from './subscription-deactivated.subscriber.js';

describe('SubscriptionDeactivatedSubscriber', () => {
  const event: Delivered<SubscriptionDeactivatedEvent> = {
    type: SubscriptionEventType.Deactivated,
    aggregateId: 'sub-1',
    occurredAt: '2024-01-01T00:00:00.000Z',
    id: 'msg-1',
    payload: {
      repo: 'owner/repo',
    },
  };

  const recipientRepository = mock<RecipientRepository>();

  let subscriber: SubscriptionDeactivatedSubscriber;

  beforeEach(() => {
    vi.resetAllMocks();

    subscriber = new SubscriptionDeactivatedSubscriber(recipientRepository);
  });

  it('deletes the notification recipient for the subscription', async () => {
    await subscriber.handle(event);

    expect(recipientRepository.delete).toHaveBeenCalledWith('sub-1');
  });
});
