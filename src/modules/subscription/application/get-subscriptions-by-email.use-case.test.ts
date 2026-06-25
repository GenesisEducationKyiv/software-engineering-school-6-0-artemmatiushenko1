import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSubscriptionsByEmailUseCase } from './get-subscriptions-by-email.use-case.js';
import type { SubscriptionRepository } from './ports/subscription.repository.ts';
import { mock } from 'vitest-mock-extended';
import { Email } from '../domain/index.js';
import { createConfirmedSubscription } from './subscription-test-fixtures.js';

describe('GetSubscriptionsByEmailUseCase', () => {
  let getSubscriptionsByEmailUseCase: GetSubscriptionsByEmailUseCase;
  const repoMock = mock<SubscriptionRepository>();

  beforeEach(() => {
    vi.resetAllMocks();

    getSubscriptionsByEmailUseCase = new GetSubscriptionsByEmailUseCase(
      repoMock,
    );
  });

  it('should return confirmed subscriptions for a valid email', async () => {
    const email = 'test@example.com';
    const subscriptions = [createConfirmedSubscription({ id: '1', email })];

    repoMock.findConfirmedSubscriptionsByEmail.mockResolvedValue(subscriptions);

    const result = await getSubscriptionsByEmailUseCase.execute(email);

    expect(result).toEqual(subscriptions);
    expect(repoMock.findConfirmedSubscriptionsByEmail).toHaveBeenCalledWith(
      Email.fromString(email),
    );
  });

  it('should return empty list for a valid email when there are no subscriptions', async () => {
    const email = 'test@example.com';

    repoMock.findConfirmedSubscriptionsByEmail.mockResolvedValue([]);

    const result = await getSubscriptionsByEmailUseCase.execute(email);

    expect(result).toEqual([]);
    expect(repoMock.findConfirmedSubscriptionsByEmail).toHaveBeenCalledWith(
      Email.fromString(email),
    );
  });
});
