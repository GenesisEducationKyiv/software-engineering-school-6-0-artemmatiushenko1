import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { SubscriptionService } from './subscription.service.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import type { GithubClient } from '../domain/github.js';
import type { EmailService } from '../domain/email.js';
import type { SubscriptionTokenManager } from '../domain/subscription-token-manager.js';
import type {
  Subscription,
  SubscriptionToken,
} from '../domain/subscription.js';
import {
  InvalidRepoFormatError,
  InvalidEmailError,
  RepoNotFoundError,
  AlreadySubscribedError,
  TokenNotFoundError,
  InvalidTokenError,
} from '../domain/errors.js';
import type { Logger } from '../domain/logger.js';
import type {
  TransactionManager,
  DomainTransaction,
} from '../domain/transaction-manager.js';
import type { ScannerService } from './scanner.service.js';

class MockTransactionManager implements TransactionManager {
  async run<T>(work: (tx: DomainTransaction) => Promise<T>): Promise<T> {
    return await work({} as DomainTransaction);
  }
}

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let repoMock: Mocked<SubscriptionRepository>;
  let githubClientMock: Mocked<GithubClient>;
  let emailServiceMock: Mocked<EmailService>;
  let tokenManagerMock: Mocked<SubscriptionTokenManager>;
  let scannerServiceMock: Mocked<ScannerService>;
  let loggerMock: Mocked<Logger>;
  let transactionManager: TransactionManager;

  beforeEach(() => {
    repoMock = {
      createSubscription: vi.fn(),
      findByEmailAndRepo: vi.fn(),
      findSubscriptionById: vi.fn(),
      findSubscriptionsByEmail: vi.fn(),
      findConfirmedSubscriptionsByEmail: vi.fn(),
      findAllConfirmedSubscriptions: vi.fn(),
      confirmSubscription: vi.fn(),
      updateLastSeenTag: vi.fn(),
      deleteSubscription: vi.fn(),
      createToken: vi.fn(),
      findToken: vi.fn(),
      findTokenByValue: vi.fn(),
      findTokenBySubscriptionIdAndScope: vi.fn(),
      deleteToken: vi.fn(),
    };

    githubClientMock = {
      repositoryExists: vi.fn(),
      getLatestRelease: vi.fn(),
    };

    emailServiceMock = {
      sendEmail: vi.fn(),
    };

    tokenManagerMock = {
      createToken: vi.fn(),
      getTokenByValue: vi.fn(),
      getTokenBySubscriptionIdAndScope: vi.fn(),
      validateToken: vi.fn(),
      invalidateToken: vi.fn(),
    };

    scannerServiceMock = {
      scanSubscription: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<ScannerService>;

    loggerMock = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    transactionManager = new MockTransactionManager();

    subscriptionService = new SubscriptionService(
      repoMock,
      githubClientMock,
      emailServiceMock,
      tokenManagerMock,
      transactionManager,
      loggerMock,
      'http://localhost:3000',
      scannerServiceMock,
      undefined,
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
    expect(emailServiceMock.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email,
        text: expect.stringContaining(confirmToken),
      }),
    );
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
    it('should successfully confirm subscription and trigger scan', async () => {
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

      tokenManagerMock.getTokenByValue.mockResolvedValue(token);
      tokenManagerMock.validateToken.mockResolvedValue(true);
      repoMock.findSubscriptionById.mockResolvedValue(sub);

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
      expect(scannerServiceMock.scanSubscription).toHaveBeenCalledWith(
        subscriptionId,
      );
      expect(loggerMock.info).toHaveBeenCalled();
    });

    it('should throw TokenNotFoundError if token is not found', async () => {
      tokenManagerMock.getTokenByValue.mockResolvedValue(null);

      await expect(
        subscriptionService.confirmSubscription('non-existent'),
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
