import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionServiceImpl } from './subscription.service.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { GithubClient } from '../../domain/github.js';
import type { NotificationService } from '../../domain/notification.js';
import {
  InvalidRepoFormatError,
  InvalidEmailError,
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
  TokenExpiredError,
  InvalidReleaseTagError,
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
import { Email } from '../../domain/subscription/email.js';
import { RepoPath } from '../../domain/subscription/repo-path.js';
import { ConfirmationToken } from '../../domain/subscription/confirmation-token.js';
import { ReleaseTag } from '../../domain/subscription/release-tag.js';
import { Subscription } from '../../domain/subscription/index.js';

const createPendingDomainSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) =>
  Subscription.request(
    overrides.id ?? '1',
    Email.fromString(overrides.email ?? 'test@example.com'),
    RepoPath.fromString(overrides.repo ?? 'owner/repo'),
    ConfirmationToken.rehydrate({
      value: '550e8400-e29b-41d4-a716-446655440000',
      scope: 'subscribe',
      expiresAt: new Date(Date.now() + 60_000),
    }),
  );

const createConfirmedDomainSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) => {
  const subscription = createPendingDomainSubscription(overrides);
  subscription.confirm(
    '550e8400-e29b-41d4-a716-446655440000',
    new Date(),
    ConfirmationToken.rehydrate({
      value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      scope: 'unsubscribe',
      expiresAt: new Date(Date.now() + 60_000),
    }),
  );

  return subscription;
};

const createUnsubscribedDomainSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) => {
  const subscription = createConfirmedDomainSubscription(overrides);
  subscription.unsubscribe('6ba7b810-9dad-11d1-80b4-00c04fd430c8', FIXED_NOW);

  return subscription;
};

const FIXED_NOW = new Date('2026-01-01T12:00:00Z');

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
    expect(savedSubscription.status).toBe('pending');
    expect(savedSubscription.email.email).toBe(email);
    expect(savedSubscription.repoPath.toString()).toBe(repo);
    expect(savedSubscription.confirmationToken.value).toBe(confirmToken);
    expect(tx).toEqual({});
    expect(
      notificationServiceMock.notifySubscriptionConfirmation,
    ).toHaveBeenCalledWith({
      email,
      repo,
      confirmToken,
    });
    expect(loggerMock.info).toHaveBeenCalled();
  });

  it('should throw InvalidRepoFormatError for invalid repo format', async () => {
    await expect(
      subscriptionService.subscribe('test@example.com', 'invalid-repo'),
    ).rejects.toThrow(InvalidRepoFormatError);
  });

  it('should throw InvalidEmailError for invalid email', async () => {
    await expect(
      subscriptionService.subscribe('invalid-email', 'owner/repo'),
    ).rejects.toThrow(InvalidEmailError);
  });

  it('should throw RepoNotFoundError if repo does not exist', async () => {
    githubClientMock.repositoryExists.mockResolvedValue(false);

    await expect(
      subscriptionService.subscribe('test@example.com', 'owner/repo'),
    ).rejects.toThrow(RepoNotFoundError);
  });

  it('should throw AlreadySubscribedError if already confirmed', async () => {
    const subscription = createConfirmedDomainSubscription();

    githubClientMock.repositoryExists.mockResolvedValue(true);
    repoMock.findByEmailAndRepo.mockResolvedValue(subscription);

    await expect(
      subscriptionService.subscribe('test@example.com', 'owner/repo'),
    ).rejects.toThrow(AlreadySubscribedError);
  });

  it('should refresh tokens and resend confirmation for an unconfirmed subscription', async () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const newConfirmToken = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const existingDomainSubscription = createPendingDomainSubscription({
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
    expect(savedSubscription.status).toBe('pending');
    expect(savedSubscription.confirmationToken.value).toBe(newConfirmToken);
    expect(tx).toEqual({});
    expect(
      notificationServiceMock.notifySubscriptionConfirmation,
    ).toHaveBeenCalledWith({
      email,
      repo,
      confirmToken: newConfirmToken,
    });
    expect(loggerMock.info).toHaveBeenCalled();
  });

  it('should reactivate an unsubscribed subscription and resend confirmation', async () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const newConfirmToken = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const existingDomainSubscription = createUnsubscribedDomainSubscription({
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
    expect(savedSubscription.status).toBe('pending');
    expect(savedSubscription.confirmationToken.value).toBe(newConfirmToken);
    expect(savedSubscription.unsubscribeToken).toBeNull();
    expect(
      notificationServiceMock.notifySubscriptionConfirmation,
    ).toHaveBeenCalledWith({
      email,
      repo,
      confirmToken: newConfirmToken,
    });
  });

  it('should not leave partial db state when confirmation email fails for a new subscription', async () => {
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
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  it('should not leave partial db state when confirmation email fails for a pending resubscribe', async () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const newConfirmToken = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const existingDomainSubscription = createPendingDomainSubscription({
      email,
      repo,
    });

    tokenGeneratorMock.generate.mockReturnValue(newConfirmToken);
    githubClientMock.repositoryExists.mockResolvedValue(true);
    repoMock.findByEmailAndRepo.mockResolvedValue(existingDomainSubscription);
    notificationServiceMock.notifySubscriptionConfirmation.mockRejectedValue(
      new Error('SMTP error'),
    );

    await expect(subscriptionService.subscribe(email, repo)).rejects.toThrow(
      'SMTP error',
    );

    expect(repoMock.save).toHaveBeenCalledTimes(1);

    const [savedSubscription] = repoMock.save.mock.calls[0]!;

    expect(savedSubscription.confirmationToken.value).toBe(newConfirmToken);
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  describe('getSubscriptionsByEmail', () => {
    it('should return confirmed subscriptions for a valid email', async () => {
      const email = 'test@example.com';
      const subscriptions = [
        createConfirmedDomainSubscription({ id: '1', email }),
      ];

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

    it('should throw InvalidEmailError for invalid email', async () => {
      await expect(
        subscriptionService.getSubscriptionsByEmail('invalid-email'),
      ).rejects.toThrow(InvalidEmailError);
    });
  });

  describe('observeNewRelease', () => {
    it('should update lastSeenTag and save for a confirmed subscription', async () => {
      const subscription = createConfirmedDomainSubscription({ id: '10' });

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

    it('should throw InvalidReleaseTagError for an invalid tag', async () => {
      const subscription = createConfirmedDomainSubscription({ id: '10' });

      repoMock.findById.mockResolvedValue(subscription);

      await expect(
        subscriptionService.observeNewRelease('10', ''),
      ).rejects.toThrow(InvalidReleaseTagError);

      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('should still save when subscription is not confirmed', async () => {
      const subscription = createPendingDomainSubscription({ id: '10' });

      repoMock.findById.mockResolvedValue(subscription);

      await subscriptionService.observeNewRelease('10', 'v1.0.0');

      expect(subscription.lastSeenTag).toBeNull();
      expect(repoMock.save).toHaveBeenCalledWith(
        subscription,
        expect.anything(),
      );
    });

    it('should not save when the release tag is unchanged', async () => {
      const subscription = createConfirmedDomainSubscription({ id: '10' });
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
      const subscription = createPendingDomainSubscription({
        id: '10',
      });

      tokenGeneratorMock.generate.mockReturnValue(unsubscribeTokenValue);
      repoMock.findByToken.mockResolvedValue(subscription);

      await subscriptionService.confirm(tokenValue);

      expect(repoMock.findByToken).toHaveBeenCalledWith(
        tokenValue,
        'subscribe',
      );
      expect(tokenGeneratorMock.generate).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '10',
          status: 'confirmed',
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
      expect(loggerMock.info).toHaveBeenCalled();
    });

    it('should throw SubscriptionNotFoundError when token cannot be resolved', async () => {
      repoMock.findByToken.mockResolvedValue(null);

      await expect(subscriptionService.confirm('non-existent')).rejects.toThrow(
        SubscriptionNotFoundError,
      );
    });

    it('should throw SubscriptionNotFoundError when token has wrong scope', async () => {
      const tokenValue = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      repoMock.findByToken.mockResolvedValue(null);

      await expect(subscriptionService.confirm(tokenValue)).rejects.toThrow(
        SubscriptionNotFoundError,
      );
    });

    it('should throw TokenExpiredError if token is expired', async () => {
      const tokenValue = '550e8400-e29b-41d4-a716-446655440000';
      const subscription = Subscription.request(
        '10',
        Email.fromString('test@example.com'),
        RepoPath.fromString('owner/repo'),
        ConfirmationToken.rehydrate({
          value: tokenValue,
          scope: 'subscribe',
          expiresAt: new Date('2026-01-01T11:00:00Z'),
        }),
      );

      tokenGeneratorMock.generate.mockReturnValue(
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      );
      repoMock.findByToken.mockResolvedValue(subscription);

      await expect(subscriptionService.confirm(tokenValue)).rejects.toThrow(
        TokenExpiredError,
      );
    });
  });

  describe('unsubscribe', () => {
    it('should successfully unsubscribe', async () => {
      const tokenValue = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const subscription = createConfirmedDomainSubscription({ id: '10' });

      repoMock.findByToken.mockResolvedValue(subscription);

      await subscriptionService.unsubscribe(tokenValue);

      expect(repoMock.findByToken).toHaveBeenCalledWith(
        tokenValue,
        'unsubscribe',
      );
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '10',
          status: 'unsubscribed',
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

    it('should throw TokenExpiredError if token is expired', async () => {
      const tokenValue = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const subscription = createPendingDomainSubscription({ id: '10' });
      subscription.confirm(
        '550e8400-e29b-41d4-a716-446655440000',
        new Date(),
        ConfirmationToken.rehydrate({
          value: tokenValue,
          scope: 'unsubscribe',
          expiresAt: new Date('2026-01-01T11:00:00Z'),
        }),
      );

      repoMock.findByToken.mockResolvedValue(subscription);

      await expect(subscriptionService.unsubscribe(tokenValue)).rejects.toThrow(
        TokenExpiredError,
      );
    });
  });
});
