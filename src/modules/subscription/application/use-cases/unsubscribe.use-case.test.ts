import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnsubscribeUseCase } from './unsubscribe.use-case.js';
import type { SubscriptionRepository } from '../ports/subscription.repository.ts';
import { SubscriptionNotFoundError } from '../errors.js';
import type {
  Clock,
  TransactionManager,
  DomainTransaction,
  Logger,
} from '../../../../shared-kernel/index.js';
import { mock } from 'vitest-mock-extended';
import {
  SubscriptionTokenScope,
  SubscriptionStatus,
} from '../../domain/index.js';
import {
  createConfirmedSubscription,
  FIXED_NOW,
} from './subscription-test-fixtures.js';

describe('UnsubscribeUseCase', () => {
  let unsubscribeUseCase: UnsubscribeUseCase;
  const repoMock = mock<SubscriptionRepository>();
  const loggerMock = mock<Logger>();
  const transactionManagerMock = mock<TransactionManager>();
  const clockMock = mock<Clock>();

  beforeEach(() => {
    vi.resetAllMocks();

    clockMock.now.mockReturnValue(FIXED_NOW);

    transactionManagerMock.run.mockImplementation(
      async (work) => await work({} as DomainTransaction),
    );

    unsubscribeUseCase = new UnsubscribeUseCase(
      repoMock,
      transactionManagerMock,
      loggerMock,
      clockMock,
    );
  });

  it('should successfully unsubscribe', async () => {
    const tokenValue = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const subscription = createConfirmedSubscription({ id: '10' });

    repoMock.findByToken.mockResolvedValue(subscription);

    await unsubscribeUseCase.execute(tokenValue);

    expect(repoMock.findByToken).toHaveBeenCalledWith(
      tokenValue,
      SubscriptionTokenScope.Unsubscribe,
    );
    expect(repoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '10',
        status: SubscriptionStatus.Unsubscribed,
      }),
      expect.anything(),
    );
    expect(loggerMock.info).toHaveBeenCalled();
  });

  it('should throw SubscriptionNotFoundError when token cannot be resolved', async () => {
    repoMock.findByToken.mockResolvedValue(null);

    await expect(unsubscribeUseCase.execute('non-existent')).rejects.toThrow(
      SubscriptionNotFoundError,
    );
  });
});
