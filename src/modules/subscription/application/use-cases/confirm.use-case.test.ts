import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfirmUseCase } from './confirm.use-case.js';
import type { SubscriptionRepository } from '../ports/subscription.repository.ts';
import { SubscriptionNotFoundError } from '../errors.js';
import type {
  Clock,
  TransactionManager,
  DomainTransaction,
  Logger,
} from '../../../../shared-kernel/index.js';
import type { TokenGenerator } from '../ports/token-generator.js';
import type { EventBus } from '../../../../platform/event-bus/event-bus.interface.js';
import { SubscriptionEventType } from '../../api/events.js';
import { mock } from 'vitest-mock-extended';
import {
  SubscriptionTokenScope,
  SubscriptionStatus,
} from '../../domain/index.js';
import {
  createPendingSubscription,
  FIXED_NOW,
  FIXED_NOW_ISO,
} from './subscription-test-fixtures.js';

describe('ConfirmUseCase', () => {
  let confirmUseCase: ConfirmUseCase;
  const repoMock = mock<SubscriptionRepository>();
  const loggerMock = mock<Logger>();
  const transactionManagerMock = mock<TransactionManager>();
  const tokenGeneratorMock = mock<TokenGenerator>();
  const clockMock = mock<Clock>();
  const eventBusMock = mock<EventBus>();

  beforeEach(() => {
    vi.resetAllMocks();

    clockMock.now.mockReturnValue(FIXED_NOW);

    transactionManagerMock.run.mockImplementation(
      async (work) => await work({} as DomainTransaction),
    );

    eventBusMock.publish.mockResolvedValue(undefined);

    confirmUseCase = new ConfirmUseCase(
      repoMock,
      transactionManagerMock,
      loggerMock,
      tokenGeneratorMock,
      clockMock,
      eventBusMock,
    );
  });

  it('should successfully confirm subscription', async () => {
    const tokenValue = '550e8400-e29b-41d4-a716-446655440000';
    const unsubscribeTokenValue = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const subscription = createPendingSubscription({
      id: '10',
    });

    tokenGeneratorMock.generate.mockReturnValue(unsubscribeTokenValue);
    repoMock.findByToken.mockResolvedValue(subscription);

    await confirmUseCase.execute(tokenValue);

    expect(repoMock.findByToken).toHaveBeenCalledWith(
      tokenValue,
      SubscriptionTokenScope.Confirm,
    );
    expect(tokenGeneratorMock.generate).toHaveBeenCalled();
    expect(repoMock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '10',
        status: SubscriptionStatus.Confirmed,
      }),
      expect.anything(),
    );
    expect(eventBusMock.publish).toHaveBeenCalledWith([
      {
        type: SubscriptionEventType.Confirmed,
        aggregateId: '10',
        occurredAt: FIXED_NOW_ISO,
        payload: {
          email: 'test@example.com',
          repo: 'owner/repo',
          unsubscribeToken: unsubscribeTokenValue,
        },
      },
    ]);
  });

  it('should throw SubscriptionNotFoundError when token cannot be resolved', async () => {
    repoMock.findByToken.mockResolvedValue(null);

    await expect(confirmUseCase.execute('non-existent')).rejects.toThrow(
      SubscriptionNotFoundError,
    );
  });
});
