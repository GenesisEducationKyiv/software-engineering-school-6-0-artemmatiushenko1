import type { GithubClient } from '../../domain/github.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { NotificationService } from '../../domain/notification.js';
import type {
  Subscription,
  SubscriptionService,
} from '../../domain/subscription.js';
import { Subscription as DomainSubscription } from '../../domain/subscription/subscription.js';
import type { SubscriptionTokenManager } from './db-subscription-token-manager.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
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

  async findAllConfirmedSubscriptions(): Promise<DomainSubscription[]> {
    return this.subscriptionRepo.findAllConfirmedSubscriptions();
  }

  async updateLastSeenTag(id: string, tag: string): Promise<void> {
    const releaseTag = ReleaseTag.fromString(tag);
    await this.subscriptionRepo.updateLastSeenTag(id, releaseTag.value);
  }

  async confirmSubscription(tokenValue: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findByToken(
      tokenValue,
      'subscribe',
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError(tokenValue);
    }

    // TODO: use Clock
    const now = new Date();
    const unsubscribeToken = ConfirmationToken.issue({
      value: this.tokenGenerator.generate(),
      scope: 'unsubscribe',
      issuedAt: now,
      ttlMs: 24 * 60 * 60 * 1000,
    });

    subscription.confirm(tokenValue, now, unsubscribeToken);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });

    await this.notificationService.notifySubscriptionConfirmed({
      email: subscription.email.email,
      repo: subscription.repoPath.toString(),
      unsubscribeToken: unsubscribeToken.value,
    });

    this.logger.info('Subscription confirmed', {
      subscriptionId: subscription.id,
    });
  }

  async unsubscribe(tokenValue: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findByToken(
      tokenValue,
      'unsubscribe',
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError(tokenValue);
    }

    const now = new Date();
    subscription.unsubscribe(tokenValue, now);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });

    this.logger.info('User unsubscribed', {
      subscriptionId: subscription.id,
    });
  }
}
