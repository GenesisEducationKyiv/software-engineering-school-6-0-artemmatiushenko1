import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from './subscription.service.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { GithubClient } from '../../domain/github.js';
import type { NotificationService } from '../../domain/notification.js';
import type { SubscriptionTokenManager } from '../../domain/subscription-token-manager.js';
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
import type {
  TransactionManager,
  DomainTransaction,
} from '../../domain/transaction-manager.js';
import { mock } from 'vitest-mock-extended';
import type { Metrics } from '../../domain/metrics.js';

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  const repoMock = mock<SubscriptionRepository>();
  const githubClientMock = mock<GithubClient>();
  const notificationServiceMock = mock<NotificationService>();
  const tokenManagerMock = mock<SubscriptionTokenManager>();
  const loggerMock = mock<Logger>();
  const transactionManagerMock = mock<TransactionManager>();
  const metricsMock = mock<Metrics>();

  beforeEach(() => {
    vi.resetAllMocks();

    transactionManagerMock.run.mockImplementation(
      async (work) => await work({} as DomainTransaction),
    );

    subscriptionService = new SubscriptionService(
      repoMock,
      githubClientMock,
      notificationServiceMock,
      tokenManagerMock,
      transactionManagerMock,
      loggerMock,
      metricsMock,
    );
  });

  it('should successfully subscribe a user', async () => {
    const email = 'test@example.com';
    const repo = 'owner/repo';
    const confirmToken = 'confirm-token';
    const subscription: Subscription = {
      id: 1,
      email,
      repo,
      confirmed: false,
      lastSeenTag: null,
      createdAt: new Date(),
    };

    repoMock.findByEmailAndRepo.mockResolvedValue(null);
    githubClientMock.repositoryExists.mockResolvedValue(true);
    repoMock.createSubscription.mockResolvedValue(subscription);
    tokenManagerMock.createToken.mockResolvedValueOnce(confirmToken);
    tokenManagerMock.createToken.mockResolvedValueOnce('unsub-token');

    const result = await subscriptionService.subscribe(email, repo);

    expect(result).toEqual(subscription);
    expect(githubClientMock.repositoryExists).toHaveBeenCalledWith(
      'owner',
      'repo',
    );
    expect(repoMock.createSubscription).toHaveBeenCalled();
    expect(tokenManagerMock.createToken).toHaveBeenCalledWith(
      subscription.id,
      'subscribe',
      expect.anything(),
    );
    expect(tokenManagerMock.createToken).toHaveBeenCalledWith(
      subscription.id,
      'unsubscribe',
      expect.anything(),
    );
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

  it('should throw AlreadySubscribedError if already subscribed', async () => {
    const subscription: Subscription = {
      id: 1,
      email: 'test@example.com',
      repo: 'owner/repo',
      confirmed: true,
      lastSeenTag: null,
      createdAt: new Date(),
    };

    githubClientMock.repositoryExists.mockResolvedValue(true);
    repoMock.findByEmailAndRepo.mockResolvedValue(subscription);

    await expect(
      subscriptionService.subscribe('test@example.com', 'owner/repo'),
    ).rejects.toThrow(AlreadySubscribedError);
  });

  describe('getSubscriptionsByEmail', () => {
    it('should return confirmed subscriptions for a valid email', async () => {
      const email = 'test@example.com';
      const subscriptions: Subscription[] = [
        {
          id: 1,
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
      const subscriptionId = 10;
      const token: SubscriptionToken = {
        id: 1,
        token: tokenValue,
        subscriptionId: subscriptionId,
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

      const unsubscribeToken: SubscriptionToken = {
        id: 2,
        token: 'unsub-token',
        subscriptionId,
        scope: 'unsubscribe',
        expiresAt: new Date(),
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
      const subscriptionId = 10;
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
      const subscriptionId = 10;
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
        subscriptionId: 10,
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
        subscriptionId: 10,
        scope: 'unsubscribe',
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      tokenManagerMock.getTokenByValue.mockResolvedValue(token);
      tokenManagerMock.validateToken.mockResolvedValue(true);

      await subscriptionService.unsubscribe(tokenValue);

      expect(tokenManagerMock.getTokenByValue).toHaveBeenCalledWith(tokenValue);
      expect(tokenManagerMock.validateToken).toHaveBeenCalledWith(
        token,
        'unsubscribe',
      );
      expect(repoMock.deleteSubscription).toHaveBeenCalledWith(
        10,
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
