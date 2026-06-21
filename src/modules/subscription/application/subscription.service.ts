import type { GithubClient } from '../../../domain/github.js';
import type { SubscriptionRepository } from '../application/ports/subscription.repository.ts';
import type { NotificationService } from '../../../domain/notification.js';
import type { SubscriptionService } from '../api/subscription-service.interface.js';
import { Subscription } from '../domain/index.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
} from '../../../domain/errors.js';
import { Email } from '../domain/email.js';
import { RepoPath } from '../domain/repo-path.js';
import { ReleaseTag } from '../domain/release-tag.js';
import type {
  IdGenerator,
  TokenGenerator,
  Clock,
  TransactionManager,
  Logger,
} from '../../../domain/shared/index.js';
import { ConfirmationToken } from '../domain/index.js';

export class SubscriptionServiceImpl implements SubscriptionService {
  private static readonly SUBSCRIPTION_CONFIRMATION_TTL_MS = 60_000;
  private static readonly UNSUBSCRIBE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private githubClient: GithubClient,
    private notificationService: NotificationService,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private idGenerator: IdGenerator,
    private tokenGenerator: TokenGenerator,
    private clock: Clock,
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
      issuedAt: this.clock.now(),
      ttlMs: SubscriptionServiceImpl.SUBSCRIPTION_CONFIRMATION_TTL_MS,
    });

    let subscription: Subscription;
    if (existingSubscription) {
      if (existingSubscription.status === 'unsubscribed') {
        existingSubscription.reactivate(confirmToken);
      } else {
        existingSubscription.renewConfirmation(confirmToken);
      }
      subscription = existingSubscription;
    } else {
      subscription = Subscription.request(
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
    return this.subscriptionRepo.findConfirmedSubscriptionsByEmail(
      Email.fromString(email),
    );
  }

  async findAllConfirmedSubscriptions(): Promise<Subscription[]> {
    return this.subscriptionRepo.findAllConfirmedSubscriptions();
  }

  async observeNewRelease(subscriptionId: string, tag: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findById(subscriptionId);

    if (!subscription) {
      throw new SubscriptionNotFoundError();
    }

    const newTag = ReleaseTag.fromString(tag);

    if (subscription.lastSeenTag?.equals(newTag)) {
      return;
    }

    subscription.observeRelease(newTag);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });
  }

  async confirm(token: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findByToken(
      token,
      'subscribe',
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError();
    }

    const now = this.clock.now();
    const unsubscribeToken = ConfirmationToken.issue({
      value: this.tokenGenerator.generate(),
      scope: 'unsubscribe',
      issuedAt: now,
      ttlMs: SubscriptionServiceImpl.UNSUBSCRIBE_TTL_MS,
    });

    subscription.confirm(token, now, unsubscribeToken);

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

  async unsubscribe(token: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findByToken(
      token,
      'unsubscribe',
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError();
    }

    const now = this.clock.now();
    subscription.unsubscribe(token, now);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });

    this.logger.info('User unsubscribed', {
      subscriptionId: subscription.id,
    });
  }
}
