import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscribeUseCase } from './subscribe.use-case.js';
import type { SubscriptionRepository } from './ports/subscription.repository.ts';
import type { GithubClient } from '../../../domain/github.js';
import type { NotificationService } from '../../notification/api/notification.service.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
} from '../../../domain/errors.js';
import type {
  IdGenerator,
  Clock,
  TransactionManager,
  DomainTransaction,
  Logger,
} from '../../../shared-kernel/index.js';
import type { TokenGenerator } from './ports/token-generator.js';
import { mock } from 'vitest-mock-extended';
import {
  SubscriptionTokenScope,
  SubscriptionStatus,
  SubscriptionToken,
} from '../domain/index.js';
import {
  CONFIRM_TOKEN_EXPIRES_AT,
  createConfirmedSubscription,
  createPendingSubscription,
  createUnsubscribedSubscription,
  FIXED_NOW,
} from './subscription-test-fixtures.js';

describe('SubscribeUseCase', () => {
  let subscribeUseCase: SubscribeUseCase;
  const repoMock = mock<SubscriptionRepository>();
  const githubClientMock = mock<GithubClient>();
  const notificationServiceMock = mock<NotificationService>();
  const loggerMock = mock<Logger>();
  const transactionManagerMock = mock<TransactionManager>();
  const idGeneratorMock = mock<IdGenerator>();
  const tokenGeneratorMock = mock<TokenGenerator>();
  const clockMock = mock<Clock>();

  beforeEach(() => {
    vi.resetAllMocks();

    clockMock.now.mockReturnValue(FIXED_NOW);

    transactionManagerMock.run.mockImplementation(
      async (work) => await work({} as DomainTransaction),
    );

    subscribeUseCase = new SubscribeUseCase(
      repoMock,
      githubClientMock,
      notificationServiceMock,
      transactionManagerMock,
      loggerMock,
      idGeneratorMock,
      tokenGeneratorMock,
      clockMock,
    );
  });

  it('should successfully subscribe a user', async () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const confirmToken = '550e8400-e29b-41d4-a716-446655440000';
    const subscriptionId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    tokenGeneratorMock.generate.mockReturnValue(confirmToken);
    idGeneratorMock.next.mockReturnValue(subscriptionId);

    repoMock.findByEmailAndRepo.mockResolvedValue(null);
    githubClientMock.repositoryExists.mockResolvedValue(true);

    await subscribeUseCase.execute(email, repo);

    expect(githubClientMock.repositoryExists).toHaveBeenCalledWith(
      'owner',
      'repo',
    );
    expect(repoMock.save).toHaveBeenCalledTimes(1);

    const [savedSubscription, tx] = repoMock.save.mock.calls[0]!;

    expect(savedSubscription.id).toBe(subscriptionId);
    expect(savedSubscription.status).toBe(SubscriptionStatus.Pending);
    expect(savedSubscription.email.value).toBe(email);
    expect(savedSubscription.repoPath.toString()).toBe(repo);
    expect(
      savedSubscription.confirmationToken.equals(
        SubscriptionToken.rehydrate({
          value: confirmToken,
          scope: SubscriptionTokenScope.Confirm,
          expiresAt: CONFIRM_TOKEN_EXPIRES_AT,
        }),
      ),
    ).toBe(true);
    expect(savedSubscription.unsubscribeToken).toBeNull();
    expect(tx).toEqual(expect.anything());
    expect(
      notificationServiceMock.notifySubscriptionConfirmation,
    ).toHaveBeenCalledWith({
      email,
      repo,
      confirmToken,
    });
  });

  it('should throw RepoNotFoundError if repo does not exist', async () => {
    githubClientMock.repositoryExists.mockResolvedValue(false);

    await expect(
      subscribeUseCase.execute('test@example.com', 'owner/repo'),
    ).rejects.toThrow(RepoNotFoundError);
  });

  it('should throw AlreadySubscribedError if already confirmed', async () => {
    const subscription = createConfirmedSubscription();

    githubClientMock.repositoryExists.mockResolvedValue(true);
    repoMock.findByEmailAndRepo.mockResolvedValue(subscription);

    await expect(
      subscribeUseCase.execute('test@example.com', 'owner/repo'),
    ).rejects.toThrow(AlreadySubscribedError);
  });

  it('should refresh tokens and resend confirmation for pending subscription', async () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const newConfirmToken = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const existingDomainSubscription = createPendingSubscription({
      email,
      repo,
    });

    tokenGeneratorMock.generate.mockReturnValue(newConfirmToken);
    githubClientMock.repositoryExists.mockResolvedValue(true);
    repoMock.findByEmailAndRepo.mockResolvedValue(existingDomainSubscription);

    await subscribeUseCase.execute(email, repo);

    expect(repoMock.save).toHaveBeenCalledTimes(1);

    const [savedSubscription, tx] = repoMock.save.mock.calls[0]!;

    expect(savedSubscription.id).toBe(existingDomainSubscription.id);
    expect(savedSubscription.status).toBe(SubscriptionStatus.Pending);
    expect(savedSubscription.confirmationToken.value).toBe(newConfirmToken);
    expect(savedSubscription.email.value).toBe(
      existingDomainSubscription.email.value,
    );
    expect(savedSubscription.repoPath.toString()).toBe(
      existingDomainSubscription.repoPath.toString(),
    );
    expect(savedSubscription.unsubscribeToken).toBeNull();
    expect(tx).toEqual(expect.anything());
    expect(
      notificationServiceMock.notifySubscriptionConfirmation,
    ).toHaveBeenCalledWith({
      email,
      repo,
      confirmToken: newConfirmToken,
    });
  });

  it('should reactivate an unsubscribed subscription and resend confirmation', async () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const newConfirmToken = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const existingDomainSubscription = createUnsubscribedSubscription({
      email,
      repo,
    });

    tokenGeneratorMock.generate.mockReturnValue(newConfirmToken);
    githubClientMock.repositoryExists.mockResolvedValue(true);
    repoMock.findByEmailAndRepo.mockResolvedValue(existingDomainSubscription);

    await subscribeUseCase.execute(email, repo);

    expect(repoMock.save).toHaveBeenCalledTimes(1);

    const [savedSubscription] = repoMock.save.mock.calls[0]!;

    expect(savedSubscription.id).toBe(existingDomainSubscription.id);
    expect(savedSubscription.status).toBe(SubscriptionStatus.Pending);
    expect(savedSubscription.confirmationToken.value).toBe(newConfirmToken);
    expect(savedSubscription.unsubscribeToken).toBeNull();
    expect(savedSubscription.email.value).toEqual(
      existingDomainSubscription.email.value,
    );
    expect(savedSubscription.repoPath).toEqual(
      existingDomainSubscription.repoPath,
    );
    expect(
      notificationServiceMock.notifySubscriptionConfirmation,
    ).toHaveBeenCalledWith({
      email,
      repo,
      confirmToken: newConfirmToken,
    });
  });

  it('should save subscription when confirmation email fails for a new subscription', async () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const confirmToken = '550e8400-e29b-41d4-a716-446655440000';
    const subscriptionId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

    tokenGeneratorMock.generate.mockReturnValue(confirmToken);
    idGeneratorMock.next.mockReturnValue(subscriptionId);
    repoMock.findByEmailAndRepo.mockResolvedValue(null);
    githubClientMock.repositoryExists.mockResolvedValue(true);
    notificationServiceMock.notifySubscriptionConfirmation.mockRejectedValue(
      new Error('SMTP error'),
    );

    await expect(subscribeUseCase.execute(email, repo)).rejects.toThrow(
      'SMTP error',
    );

    expect(repoMock.save).toHaveBeenCalledTimes(1);
  });
});
