import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionServiceImpl } from './subscription.service.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { GithubClient } from '../../domain/github.js';
import type { NotificationService } from '../../domain/notification.js';
import type { SubscriptionTokenManager } from './db-subscription-token-manager.js';
import type {
  Subscription,
  SubscriptionToken,
} from '../../domain/subscription.js';
import {
  InvalidRepoFormatError,
  InvalidEmailError,
  RepoNotFoundError,
  AlreadySubscribedError,
  TokenNotFoundError,
  InvalidTokenError,
  SubscriptionNotFoundError,
} from '../../domain/errors.js';
import type { Logger } from '../../domain/logger.js';
import type { IdGenerator } from '../../domain/id-generator.js';
import type { TokenGenerator } from '../../domain/token-generator.js';
import type {
  TransactionManager,
  DomainTransaction,
} from '../../domain/transaction-manager.js';
import { mock } from 'vitest-mock-extended';
import { Email } from '../../domain/subscription/email.js';
import { RepoPath } from '../../domain/subscription/repo-path.js';
import { ConfirmationToken } from '../../domain/subscription/confirmation-token.js';
import { Subscription as DomainSubscription } from '../../domain/subscription/subscription.js';

const createPendingDomainSubscription = (
  overrides: { id?: string; email?: string; repo?: string } = {},
) =>
  DomainSubscription.request(
    overrides.id ?? '1',
    Email.fromString(overrides.email ?? 'test@example.com'),
    RepoPath.fromString(overrides.repo ?? 'owner/repo'),
    ConfirmationToken.hydrate({
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
    ConfirmationToken.hydrate({
      value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      scope: 'unsubscribe',
      expiresAt: new Date(Date.now() + 60_000),
    }),
  );

  return subscription;
};

describe('SubscriptionServiceImpl', () => {
  let subscriptionService: SubscriptionServiceImpl;
  const repoMock = mock<SubscriptionRepository>();
  const githubClientMock = mock<GithubClient>();
  const notificationServiceMock = mock<NotificationService>();
  const tokenManagerMock = mock<SubscriptionTokenManager>();
  const loggerMock = mock<Logger>();
  const transactionManagerMock = mock<TransactionManager>();
  const idGeneratorMock = mock<IdGenerator>();
  const tokenGeneratorMock = mock<TokenGenerator>();

  beforeEach(() => {
    vi.resetAllMocks();

    transactionManagerMock.run.mockImplementation(
      async (work) => await work({} as DomainTransaction),
    );

    subscriptionService = new SubscriptionServiceImpl(
      repoMock,
      githubClientMock,
      notificationServiceMock,
      tokenManagerMock,
      transactionManagerMock,
      loggerMock,
      idGeneratorMock,
      tokenGeneratorMock,
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
    expect(tokenManagerMock.createToken).not.toHaveBeenCalled();
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
    expect(tokenManagerMock.createToken).not.toHaveBeenCalled();
    expect(tokenManagerMock.invalidateToken).not.toHaveBeenCalled();
    expect(
      notificationServiceMock.notifySubscriptionConfirmation,
    ).toHaveBeenCalledWith({
      email,
      repo,
      confirmToken: newConfirmToken,
    });
    expect(loggerMock.info).toHaveBeenCalled();
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
    expect(tokenManagerMock.createToken).not.toHaveBeenCalled();
    expect(repoMock.deleteSubscription).not.toHaveBeenCalled();
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
    expect(tokenManagerMock.createToken).not.toHaveBeenCalled();
    expect(tokenManagerMock.invalidateToken).not.toHaveBeenCalled();
    expect(repoMock.deleteSubscription).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  describe('getSubscriptionsByEmail', () => {
    it('should return confirmed subscriptions for a valid email', async () => {
      const email = 'test@example.com';
      const subscriptions: Subscription[] = [
        {
          id: '1',
          email,
          repo: 'owner/repo',
          confirmed: true,
          lastSeenTag: 'v1.0.0',
          createdAt: new Date(),
        },
      ];

      repoMock.findConfirmedSubscriptionsByEmail.mockResolvedValue(
        subscriptions,
      );

      const result = await subscriptionService.getSubscriptionsByEmail(email);

      expect(result).toEqual(subscriptions);
      expect(repoMock.findConfirmedSubscriptionsByEmail).toHaveBeenCalledWith(
        email,
      );
    });

    it('should return empty list for a valid email when there are no subscriptions', async () => {
      const email = 'test@example.com';

      repoMock.findConfirmedSubscriptionsByEmail.mockResolvedValue([]);

      const result = await subscriptionService.getSubscriptionsByEmail(email);

      expect(result).toEqual([]);
      expect(repoMock.findConfirmedSubscriptionsByEmail).toHaveBeenCalledWith(
        email,
      );
    });

    it('should throw InvalidEmailError for invalid email', async () => {
      await expect(
        subscriptionService.getSubscriptionsByEmail('invalid-email'),
      ).rejects.toThrow(InvalidEmailError);
    });
  });

  describe('confirmSubscription', () => {
    it('should successfully confirm subscription', async () => {
      const tokenValue = 'valid-token';
      const subscriptionId = '10';
      const token: SubscriptionToken = {
        id: 1,
        token: tokenValue,
        subscriptionId: subscriptionId,
        scope: 'subscribe',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      const sub: Subscription = {
        id: subscriptionId,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: false,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      const unsubscribeToken: SubscriptionToken = {
        id: 2,
        token: 'unsub-token',
        subscriptionId,
        scope: 'unsubscribe',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };

      tokenManagerMock.getTokenByValue.mockResolvedValue(token);
      tokenManagerMock.validateToken.mockResolvedValue(true);
      repoMock.findSubscriptionById.mockResolvedValue(sub);
      tokenManagerMock.getTokenBySubscriptionIdAndScope.mockResolvedValue(
        unsubscribeToken,
      );

      await subscriptionService.confirmSubscription(tokenValue);

      expect(tokenManagerMock.getTokenByValue).toHaveBeenCalledWith(tokenValue);
      expect(tokenManagerMock.validateToken).toHaveBeenCalledWith(
        token,
        'subscribe',
      );
      expect(repoMock.confirmSubscription).toHaveBeenCalledWith(
        subscriptionId,
        expect.anything(),
      );
      expect(tokenManagerMock.invalidateToken).toHaveBeenCalledWith(
        tokenValue,
        expect.anything(),
      );
      expect(
        notificationServiceMock.notifySubscriptionConfirmed,
      ).toHaveBeenCalledWith({
        email: sub.email,
        repo: sub.repo,
        unsubscribeToken: unsubscribeToken.token,
      });
      expect(loggerMock.info).toHaveBeenCalled();
    });

    it('should throw TokenNotFoundError if token is not found', async () => {
      tokenManagerMock.getTokenByValue.mockResolvedValue(null);

      await expect(
        subscriptionService.confirmSubscription('non-existent'),
      ).rejects.toThrow(TokenNotFoundError);
    });

    it('should throw SubscriptionNotFoundError if subscription is not found', async () => {
      const tokenValue = 'valid-token';
      const subscriptionId = '10';
      const token: SubscriptionToken = {
        id: 1,
        token: tokenValue,
        subscriptionId,
        scope: 'subscribe',
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      tokenManagerMock.getTokenByValue.mockResolvedValue(token);
      tokenManagerMock.validateToken.mockResolvedValue(true);
      repoMock.findSubscriptionById.mockResolvedValue(null);

      await expect(
        subscriptionService.confirmSubscription(tokenValue),
      ).rejects.toThrow(SubscriptionNotFoundError);
    });

    it('should throw TokenNotFoundError if unsubscribe token is not found', async () => {
      const tokenValue = 'valid-token';
      const subscriptionId = '10';
      const token: SubscriptionToken = {
        id: 1,
        token: tokenValue,
        subscriptionId,
        scope: 'subscribe',
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      const sub: Subscription = {
        id: subscriptionId,
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      tokenManagerMock.getTokenByValue.mockResolvedValue(token);
      tokenManagerMock.validateToken.mockResolvedValue(true);
      repoMock.findSubscriptionById.mockResolvedValue(sub);
      tokenManagerMock.getTokenBySubscriptionIdAndScope.mockResolvedValue(null);

      await expect(
        subscriptionService.confirmSubscription(tokenValue),
      ).rejects.toThrow(TokenNotFoundError);
    });

    it('should throw InvalidTokenError if token is invalid', async () => {
      const token: SubscriptionToken = {
        id: 1,
        token: 'invalid',
        subscriptionId: '10',
        scope: 'subscribe',
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      tokenManagerMock.getTokenByValue.mockResolvedValue(token);
      tokenManagerMock.validateToken.mockResolvedValue(false);

      await expect(
        subscriptionService.confirmSubscription('invalid'),
      ).rejects.toThrow(InvalidTokenError);
    });
  });

  describe('unsubscribe', () => {
    it('should successfully unsubscribe', async () => {
      const tokenValue = 'unsub-token';
      const token: SubscriptionToken = {
        id: 1,
        token: tokenValue,
        subscriptionId: '10',
        scope: 'unsubscribe',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      const sub: Subscription = {
        id: '10',
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmed: true,
        lastSeenTag: null,
        createdAt: new Date(),
      };

      tokenManagerMock.getTokenByValue.mockResolvedValue(token);
      tokenManagerMock.validateToken.mockResolvedValue(true);
      repoMock.findSubscriptionById.mockResolvedValue(sub);

      await subscriptionService.unsubscribe(tokenValue);

      expect(tokenManagerMock.getTokenByValue).toHaveBeenCalledWith(tokenValue);
      expect(tokenManagerMock.validateToken).toHaveBeenCalledWith(
        token,
        'unsubscribe',
      );
      expect(repoMock.deleteSubscription).toHaveBeenCalledWith(
        '10',
        expect.anything(),
      );
      expect(tokenManagerMock.invalidateToken).toHaveBeenCalledWith(
        tokenValue,
        expect.anything(),
      );
      expect(loggerMock.info).toHaveBeenCalled();
    });
  });
});
