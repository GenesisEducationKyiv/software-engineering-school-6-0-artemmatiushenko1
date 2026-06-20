import type { GithubClient } from '../../domain/github.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { NotificationService } from '../../domain/notification.js';
import type {
  Subscription,
  SubscriptionService,
  SubscriptionToken,
} from '../../domain/subscription.js';
import type { SubscriptionTokenManager } from './db-subscription-token-manager.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
  TokenNotFoundError,
  InvalidTokenError,
  SubscriptionNotFoundError,
} from '../../domain/errors.js';
import { Email } from '../../domain/subscription/email.js';
import { RepoPath } from '../../domain/subscription/repo-path.js';
import { ReleaseTag } from '../../domain/subscription/release-tag.js';
import type { Logger } from '../../domain/logger.js';
import type {
  TransactionManager,
  DomainTransaction,
} from '../../domain/transaction-manager.js';
import { SubscriptionRowMapper } from './subscription-row.mapper.js';

export class SubscriptionServiceImpl implements SubscriptionService {
  private readonly mapper = new SubscriptionRowMapper();

  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private githubClient: GithubClient,
    private notificationService: NotificationService,
    private tokenManager: SubscriptionTokenManager,
    private transactionManager: TransactionManager,
    private logger: Logger,
  ) {}

  async subscribe(email: string, repoPath: string): Promise<Subscription> {
    const validatedEmail = Email.fromString(email);
    const validatedRepo = RepoPath.fromString(repoPath);

    const exists = await this.githubClient.repositoryExists(
      validatedRepo.owner,
      validatedRepo.repo,
    );
    if (!exists) {
      throw new RepoNotFoundError(validatedRepo.toString());
    }

    const existing = await this.subscriptionRepo.findByEmailAndRepo(
      validatedEmail.email,
      validatedRepo.toString(),
    );
    if (existing?.confirmed) {
      throw new AlreadySubscribedError(
        validatedEmail.email,
        validatedRepo.toString(),
      );
    }

    const { subscription, confirmToken } = await this.transactionManager.run(
      async (tx) => {
        if (existing) {
          return {
            subscription: existing,
            confirmToken: await this.refreshPendingSubscriptionTokens(
              existing.id,
              tx,
            ),
          };
        }

        const subscription = await this.subscriptionRepo.createSubscription(
          {
            email: validatedEmail.email,
            repo: validatedRepo.toString(),
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
      email: validatedEmail.email,
      repo: validatedRepo.toString(),
      confirmToken,
    });

    this.logger.info('User subscribed', {
      email: validatedEmail.email,
      repoPath: validatedRepo.toString(),
    });

    return subscription;
  }

  private async refreshPendingSubscriptionTokens(
    subscriptionId: number,
    tx: DomainTransaction,
  ): Promise<string> {
    const existingSubscribeToken =
      await this.tokenManager.getTokenBySubscriptionIdAndScope(
        subscriptionId,
        'subscribe',
      );
    if (existingSubscribeToken) {
      await this.tokenManager.invalidateToken(existingSubscribeToken.token, tx);
    }

    const existingUnsubscribeToken =
      await this.tokenManager.getTokenBySubscriptionIdAndScope(
        subscriptionId,
        'unsubscribe',
      );
    if (existingUnsubscribeToken) {
      await this.tokenManager.invalidateToken(
        existingUnsubscribeToken.token,
        tx,
      );
    }

    await this.tokenManager.createToken(subscriptionId, 'unsubscribe', tx);

    return this.tokenManager.createToken(subscriptionId, 'subscribe', tx);
  }

  async getSubscriptionsByEmail(email: string): Promise<Subscription[]> {
    const validatedEmail = Email.fromString(email);

    return this.subscriptionRepo.findConfirmedSubscriptionsByEmail(
      validatedEmail.email,
    );
  }

  async findAllConfirmedSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepo.findAllConfirmedSubscriptions();
  }

  async findSubscriptionById(id: number): Promise<Subscription | null> {
    return this.subscriptionRepo.findSubscriptionById(id);
  }

  async updateLastSeenTag(id: number, tag: string): Promise<void> {
    const releaseTag = ReleaseTag.fromString(tag);
    await this.subscriptionRepo.updateLastSeenTag(id, releaseTag.value);
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

    const sub = await this.subscriptionRepo.findSubscriptionById(
      token.subscriptionId,
    );

    if (!sub) {
      throw new SubscriptionNotFoundError(token.subscriptionId);
    }

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

    const domainSubscription = this.mapper.toDomain(sub, { subscribe: token });
    const now = new Date();

    domainSubscription.confirm(
      tokenValue,
      now,
      this.mapper.tokenMapper.toDomain(unsubscribeToken),
    );

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.confirmSubscription(token.subscriptionId, tx);
      await this.tokenManager.invalidateToken(tokenValue, tx);
    });

    await this.notificationService.notifySubscriptionConfirmed({
      email: sub.email,
      repo: sub.repo,
      unsubscribeToken: unsubscribeToken.token,
    });

    this.logger.info('Subscription confirmed', {
      subscriptionId: token.subscriptionId,
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

    if (!sub) {
      throw new SubscriptionNotFoundError(token.subscriptionId);
    }

    const domainSubscription = this.mapper.toDomain(sub, {
      unsubscribe: token,
    });
    const now = new Date();

    domainSubscription.unsubscribe(tokenValue, now);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.deleteSubscription(token.subscriptionId, tx);
      await this.tokenManager.invalidateToken(tokenValue, tx);
    });

    this.logger.info('User unsubscribed', {
      subscriptionId: token.subscriptionId,
    });
  }
}
