import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionServiceImpl } from './subscription.service.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { GithubClient } from '../../domain/github.js';
import type { NotificationService } from '../../domain/notification.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
} from '../../domain/errors.js';
import type { Logger } from '../../domain/shared/index.js';
import type {
  IdGenerator,
  TokenGenerator,
  Clock,
  TransactionManager,
  DomainTransaction,
} from '../../domain/shared/index.js';
import { mock } from 'vitest-mock-extended';
import {
  Email,
  SubscriptionTokenScope,
  SubscriptionStatus,
  Subscription,
  SubscriptionToken,
  RepoPath,
  ReleaseTag,
} from '../../domain/subscription/index.js';

const FIXED_NOW = new Date('2026-01-01T12:00:00Z');
const TOKEN_EXPIRES_AT = new Date('2026-01-01T13:00:00Z');
const CONFIRM_TOKEN_EXPIRES_AT = new Date('2026-01-01T12:01:00Z');

const createPendingSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) =>
  Subscription.request(
    overrides.id ?? '1',
    Email.fromString(overrides.email ?? 'test@example.com'),
    RepoPath.fromString(overrides.repo ?? 'owner/repo'),
    SubscriptionToken.rehydrate({
      value: '550e8400-e29b-41d4-a716-446655440000',
      scope: SubscriptionTokenScope.Confirm,
      expiresAt: TOKEN_EXPIRES_AT,
    }),
  );

const createConfirmedSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) => {
  const subscription = createPendingSubscription(overrides);
  subscription.confirm(
    '550e8400-e29b-41d4-a716-446655440000',
    FIXED_NOW,
    SubscriptionToken.rehydrate({
      value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      scope: SubscriptionTokenScope.Unsubscribe,
      expiresAt: null,
    }),
  );

  return subscription;
};

const createUnsubscribedSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) => {
  const subscription = createConfirmedSubscription(overrides);
  subscription.unsubscribe('6ba7b810-9dad-11d1-80b4-00c04fd430c8', FIXED_NOW);

  return subscription;
};

describe('SubscriptionServiceImpl', () => {
  let subscriptionService: SubscriptionServiceImpl;
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

    subscriptionService = new SubscriptionServiceImpl(
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

    await subscriptionService.subscribe(email, repo);

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
      subscriptionService.subscribe('test@example.com', 'owner/repo'),
    ).rejects.toThrow(RepoNotFoundError);
  });

  it('should throw AlreadySubscribedError if already confirmed', async () => {
    const subscription = createConfirmedSubscription();

    githubClientMock.repositoryExists.mockResolvedValue(true);
    repoMock.findByEmailAndRepo.mockResolvedValue(subscription);

    await expect(
      subscriptionService.subscribe('test@example.com', 'owner/repo'),
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

    await subscriptionService.subscribe(email, repo);

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

    await subscriptionService.subscribe(email, repo);

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

    await expect(subscriptionService.subscribe(email, repo)).rejects.toThrow(
      'SMTP error',
    );

    expect(repoMock.save).toHaveBeenCalledTimes(1);
  });

  describe('getSubscriptionsByEmail', () => {
    it('should return confirmed subscriptions for a valid email', async () => {
      const email = 'test@example.com';
      const subscriptions = [createConfirmedSubscription({ id: '1', email })];

      repoMock.findConfirmedSubscriptionsByEmail.mockResolvedValue(
        subscriptions,
      );

      const result = await subscriptionService.getSubscriptionsByEmail(email);

      expect(result).toEqual(subscriptions);
      expect(repoMock.findConfirmedSubscriptionsByEmail).toHaveBeenCalledWith(
        Email.fromString(email),
      );
    });

    it('should return empty list for a valid email when there are no subscriptions', async () => {
      const email = 'test@example.com';

      repoMock.findConfirmedSubscriptionsByEmail.mockResolvedValue([]);

      const result = await subscriptionService.getSubscriptionsByEmail(email);

      expect(result).toEqual([]);
      expect(repoMock.findConfirmedSubscriptionsByEmail).toHaveBeenCalledWith(
        Email.fromString(email),
      );
    });
  });

  describe('observeNewRelease', () => {
    it('should update lastSeenTag and save for a confirmed subscription', async () => {
      const subscription = createConfirmedSubscription({ id: '10' });

      repoMock.findById.mockResolvedValue(subscription);

      await subscriptionService.observeNewRelease('10', 'v1.0.0');

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
        subscriptionService.observeNewRelease('missing-id', 'v1.0.0'),
      ).rejects.toThrow(SubscriptionNotFoundError);

      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('should not save when the release tag is unchanged', async () => {
      const subscription = createConfirmedSubscription({ id: '10' });
      subscription.observeRelease(ReleaseTag.fromString('v1.0.0'));

      repoMock.findById.mockResolvedValue(subscription);

      await subscriptionService.observeNewRelease('10', 'v1.0.0');

      expect(repoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('confirmSubscription', () => {
    it('should successfully confirm subscription', async () => {
      const tokenValue = '550e8400-e29b-41d4-a716-446655440000';
      const unsubscribeTokenValue = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const subscription = createPendingSubscription({
        id: '10',
      });

      tokenGeneratorMock.generate.mockReturnValue(unsubscribeTokenValue);
      repoMock.findByToken.mockResolvedValue(subscription);

      await subscriptionService.confirm(tokenValue);

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
      expect(
        notificationServiceMock.notifySubscriptionConfirmed,
      ).toHaveBeenCalledWith({
        email: 'test@example.com',
        repo: 'owner/repo',
        unsubscribeToken: unsubscribeTokenValue,
      });
    });

    it('should throw SubscriptionNotFoundError when token cannot be resolved', async () => {
      repoMock.findByToken.mockResolvedValue(null);

      await expect(subscriptionService.confirm('non-existent')).rejects.toThrow(
        SubscriptionNotFoundError,
      );
    });
  });

  describe('unsubscribe', () => {
    it('should successfully unsubscribe', async () => {
      const tokenValue = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const subscription = createConfirmedSubscription({ id: '10' });

      repoMock.findByToken.mockResolvedValue(subscription);

      await subscriptionService.unsubscribe(tokenValue);

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

      await expect(
        subscriptionService.unsubscribe('non-existent'),
      ).rejects.toThrow(SubscriptionNotFoundError);
    });
  });
});
