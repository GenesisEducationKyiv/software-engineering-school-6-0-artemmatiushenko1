import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionQueriesImpl } from './subscription-queries.js';
import type { SubscriptionRepository } from './ports/subscription.repository.ts';
import { SubscriptionNotFoundError } from './errors.js';
import type {
  TransactionManager,
  DomainTransaction,
} from '../../../shared-kernel/index.js';
import { mock } from 'vitest-mock-extended';
import { ReleaseTag } from '../domain/index.js';
import { createConfirmedSubscription } from './subscription-test-fixtures.js';

describe('SubscriptionQueriesImpl', () => {
  let subscriptionQueries: SubscriptionQueriesImpl;
  const repoMock = mock<SubscriptionRepository>();
  const transactionManagerMock = mock<TransactionManager>();

  beforeEach(() => {
    vi.resetAllMocks();

    transactionManagerMock.run.mockImplementation(
      async (work) => await work({} as DomainTransaction),
    );

    subscriptionQueries = new SubscriptionQueriesImpl(
      repoMock,
      transactionManagerMock,
    );
  });

  describe('observeNewRelease', () => {
    it('should update lastSeenTag and save for a confirmed subscription', async () => {
      const subscription = createConfirmedSubscription({ id: '10' });

      repoMock.findById.mockResolvedValue(subscription);

      await subscriptionQueries.observeNewRelease('10', 'v1.0.0');

      expect(repoMock.findById).toHaveBeenCalledWith('10');
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '10',
          lastSeenTag: ReleaseTag.fromString('v1.0.0'),
        }),
        expect.anything(),
      );
    });

    it('should throw SubscriptionNotFoundError when subscription is not found', async () => {
      repoMock.findById.mockResolvedValue(null);

      await expect(
        subscriptionQueries.observeNewRelease('missing-id', 'v1.0.0'),
      ).rejects.toThrow(SubscriptionNotFoundError);

      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('should not save when the release tag is unchanged', async () => {
      const subscription = createConfirmedSubscription({ id: '10' });
      subscription.observeRelease(ReleaseTag.fromString('v1.0.0'));

      repoMock.findById.mockResolvedValue(subscription);

      await subscriptionQueries.observeNewRelease('10', 'v1.0.0');

      expect(repoMock.save).not.toHaveBeenCalled();
    });
  });
});
