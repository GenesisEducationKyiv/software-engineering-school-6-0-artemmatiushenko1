import type { GithubClient } from '../../domain/github.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { NotificationService } from '../../domain/notification.js';
import type { Subscription } from '../../domain/subscription.js';
import { RepoPathSchema } from '../../domain/subscription.js';
import type { SubscriptionToken } from '../../domain/subscription.js';
import type { DbSubscriptionTokenManager } from './db-subscription-token-manager.js';
import {
  InvalidRepoFormatError,
  InvalidEmailError,
  RepoNotFoundError,
  AlreadySubscribedError,
  TokenNotFoundError,
  InvalidTokenError,
  SubscriptionNotFoundError,
} from '../../domain/errors.js';
import { z } from 'zod';
import { parseRepoPath } from '../../utils/repo.utils.js';
import type { Logger } from '../../domain/logger.js';
import type { TransactionManager } from '../../domain/transaction-manager.js';
import type { Metrics } from '../../domain/metrics.js';

export class SubscriptionService {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private githubClient: GithubClient,
    private notificationService: NotificationService,
    private tokenManager: DbSubscriptionTokenManager,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private metrics?: Metrics,
  ) {}

  async subscribe(email: string, repoPath: string): Promise<Subscription> {
    const repoResult = RepoPathSchema.safeParse(repoPath);
    if (!repoResult.success) {
      throw new InvalidRepoFormatError(repoPath);
    }

    const emailResult = z.email().safeParse(email);
    if (!emailResult.success) {
      throw new InvalidEmailError(email);
    }

    const validatedRepo = repoResult.data;
    const validatedEmail = emailResult.data;

    this.metrics?.incrementSubscriptionRequests(validatedRepo);

    const { owner, repo } = parseRepoPath(validatedRepo);

    const exists = await this.githubClient.repositoryExists(owner, repo);
    if (!exists) {
      throw new RepoNotFoundError(validatedRepo);
    }

    const existing = await this.subscriptionRepo.findByEmailAndRepo(
      validatedEmail,
      validatedRepo,
    );
    if (existing) {
      throw new AlreadySubscribedError(validatedEmail, validatedRepo);
    }

    const { subscription, confirmToken } = await this.transactionManager.run(
      async (tx) => {
        const subscription = await this.subscriptionRepo.createSubscription(
          {
            email: validatedEmail,
            repo: validatedRepo,
          },
          tx,
        );

        const confirmToken = await this.tokenManager.createToken(
          subscription.id,
          'subscribe',
          tx,
        );

        await this.tokenManager.createToken(subscription.id, 'unsubscribe', tx);

        return { subscription, confirmToken };
      },
    );

    await this.notificationService.notifySubscriptionConfirmation({
      email: validatedEmail,
      repo: validatedRepo,
      confirmToken,
    });

    this.logger.info('User subscribed', {
      email: validatedEmail,
      repoPath: validatedRepo,
    });

    return subscription;
  }

  async getSubscriptionsByEmail(email: string): Promise<Subscription[]> {
    const emailResult = z.email().safeParse(email);
    if (!emailResult.success) {
      throw new InvalidEmailError(email);
    }

    return this.subscriptionRepo.findConfirmedSubscriptionsByEmail(
      emailResult.data,
    );
  }

  async findAllConfirmedSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepo.findAllConfirmedSubscriptions();
  }

  async findSubscriptionById(id: number): Promise<Subscription | null> {
    return this.subscriptionRepo.findSubscriptionById(id);
  }

  async updateLastSeenTag(id: number, tag: string): Promise<void> {
    await this.subscriptionRepo.updateLastSeenTag(id, tag);
  }

  async getUnsubscribeToken(
    subscriptionId: number,
  ): Promise<SubscriptionToken | null> {
    return this.tokenManager.getTokenBySubscriptionIdAndScope(
      subscriptionId,
      'unsubscribe',
    );
  }

  async confirmSubscription(tokenValue: string): Promise<void> {
    const token = await this.tokenManager.getTokenByValue(tokenValue);

    if (!token) {
      throw new TokenNotFoundError();
    }

    const isValid = await this.tokenManager.validateToken(token, 'subscribe');
    if (!isValid) {
      throw new InvalidTokenError();
    }

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.confirmSubscription(token.subscriptionId, tx);
      await this.tokenManager.invalidateToken(tokenValue, tx);
    });

    const sub = await this.subscriptionRepo.findSubscriptionById(
      token.subscriptionId,
    );

    if (!sub) {
      throw new SubscriptionNotFoundError(token.subscriptionId);
    }

    this.logger.info('Subscription confirmed', {
      subscriptionId: token.subscriptionId,
    });

    this.metrics?.incrementSubscriptionConfirmations(sub.repo);

    const unsubscribeToken =
      await this.tokenManager.getTokenBySubscriptionIdAndScope(
        sub.id,
        'unsubscribe',
      );
    if (!unsubscribeToken) {
      throw new TokenNotFoundError(
        `Unsubscribe token not found for subscription ${sub.id}`,
      );
    }

    await this.notificationService.notifySubscriptionConfirmed({
      email: sub.email,
      repo: sub.repo,
      unsubscribeToken: unsubscribeToken.token,
    });
  }

  async unsubscribe(tokenValue: string): Promise<void> {
    const token = await this.tokenManager.getTokenByValue(tokenValue);

    if (!token) {
      throw new TokenNotFoundError();
    }

    const isValid = await this.tokenManager.validateToken(token, 'unsubscribe');
    if (!isValid) {
      throw new InvalidTokenError();
    }

    const sub = await this.subscriptionRepo.findSubscriptionById(
      token.subscriptionId,
    );
    if (sub) {
      this.metrics?.incrementUnsubscribeRequests(sub.repo);
    }

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.deleteSubscription(token.subscriptionId, tx);
      await this.tokenManager.invalidateToken(tokenValue, tx);
    });

    this.logger.info('User unsubscribed', {
      subscriptionId: token.subscriptionId,
    });
  }
}
