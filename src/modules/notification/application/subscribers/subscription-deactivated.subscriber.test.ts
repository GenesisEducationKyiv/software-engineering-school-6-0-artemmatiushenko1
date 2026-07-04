import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { SubscriptionEventType } from '../../../subscription/api/events.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';
import { SubscriptionDeactivatedSubscriber } from './subscription-deactivated.subscriber.js';

describe('SubscriptionDeactivatedSubscriber', () => {
  it('deletes the notification recipient for the subscription', async () => {
    const recipientRepository = mock<RecipientRepository>();
    const subscriber = new SubscriptionDeactivatedSubscriber(
      recipientRepository,
    );

    await subscriber.handle({
      type: SubscriptionEventType.Deactivated,
      aggregateId: 'sub-1',
      occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      payload: {
        repo: 'owner/repo',
      },
    });

    expect(recipientRepository.delete).toHaveBeenCalledWith('sub-1');
  });
});
