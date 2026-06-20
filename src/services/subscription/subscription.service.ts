import type { GithubClient } from '../../domain/github.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { NotificationService } from '../../domain/notification.js';
import type {
  Subscription,
  SubscriptionService,
  SubscriptionToken,
} from '../../domain/subscription.js';
import { Subscription as DomainSubscription } from '../../domain/subscription/subscription.js';
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
import type { IdGenerator } from '../../domain/id-generator.js';
import type { TokenGenerator } from '../../domain/token-generator.js';
import type { TransactionManager } from '../../domain/transaction-manager.js';
import { ConfirmationToken } from '../../domain/subscription/confirmation-token.js';

export class SubscriptionServiceImpl implements SubscriptionService {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private githubClient: GithubClient,
    private notificationService: NotificationService,
    private tokenManager: SubscriptionTokenManager,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private idGenerator: IdGenerator,
    private tokenGenerator: TokenGenerator,
  ) {}

  async subscribe(email: string, repoPath: string): Promise<void> {
    const validatedEmail = Email.fromString(email);
    const validatedRepo = RepoPath.fromString(repoPath);

    const exists = await this.githubClient.repositoryExists(
      validatedRepo.owner,
      validatedRepo.repo,
    );
    if (!exists) {
      throw new RepoNotFoundError(validatedRepo.toString());
    }

    const existingSubscription = await this.subscriptionRepo.findByEmailAndRepo(
      validatedEmail,
      validatedRepo,
    );

    if (existingSubscription?.status === 'confirmed') {
      throw new AlreadySubscribedError(
        validatedEmail.email,
        validatedRepo.toString(),
      );
    }

    const confirmToken = ConfirmationToken.issue({
      value: this.tokenGenerator.generate(),
      scope: 'subscribe',
      issuedAt: new Date(),
      ttlMs: 60_000,
    });

    let subscription: DomainSubscription;
    if (existingSubscription) {
      existingSubscription.renewConfirmation(confirmToken);
      subscription = existingSubscription;
    } else {
      subscription = DomainSubscription.request(
        this.idGenerator.next(),
        validatedEmail,
        validatedRepo,
        confirmToken,
      );
    }

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });

    await this.notificationService.notifySubscriptionConfirmation({
      confirmToken: subscription.confirmationToken.value,
      email: validatedEmail.email,
      repo: validatedRepo.toString(),
    });

    this.logger.info('User subscribed', {
      email: validatedEmail.email,
      repoPath: validatedRepo.toString(),
    });
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

  async findSubscriptionById(id: string): Promise<Subscription | null> {
    return this.subscriptionRepo.findSubscriptionById(id);
  }

  async updateLastSeenTag(id: string, tag: string): Promise<void> {
    const releaseTag = ReleaseTag.fromString(tag);
    await this.subscriptionRepo.updateLastSeenTag(id, releaseTag.value);
  }

  async getUnsubscribeToken(
    subscriptionId: string,
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

    // const domainSubscription = this.mapper.toDomain(sub, { subscribe: token });
    // const now = new Date();

    // domainSubscription.confirm(
    //   tokenValue,
    //   now,
    //   this.mapper.tokenMapper.toDomain(unsubscribeToken),
    // );

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

    // const domainSubscription = this.mapper.toDomain(sub, {
    //   unsubscribe: token,
    // });
    // const now = new Date();

    // domainSubscription.unsubscribe(tokenValue, now);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.deleteSubscription(token.subscriptionId, tx);
      await this.tokenManager.invalidateToken(tokenValue, tx);
    });

    this.logger.info('User unsubscribed', {
      subscriptionId: token.subscriptionId,
    });
  }
}
