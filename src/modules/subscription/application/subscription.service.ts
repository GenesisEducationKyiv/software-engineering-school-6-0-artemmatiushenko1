import type { GithubClient } from '../../../domain/github.js';
import type { SubscriptionRepository } from '../application/ports/subscription.repository.js';
import type { NotificationService } from '../../notification/api/notification.service.js';
import type { SubscriptionService } from '../api/subscription-service.interface.js';
import {
  Subscription,
  SubscriptionToken,
  SubscriptionTokenScope,
  SubscriptionStatus,
} from '../domain/index.js';
import {
  RepoNotFoundError,
  AlreadySubscribedError,
  SubscriptionNotFoundError,
} from '../../../domain/errors.js';
import { Email } from '../domain/email.js';
import { RepoPath } from '../domain/repo-path.js';
import { ReleaseTag } from '../domain/release-tag.js';
import type { TokenGenerator } from './ports/token-generator.js';
import type {
  Clock,
  IdGenerator,
  Logger,
  TransactionManager,
} from '../../../shared-kernel/index.js';

export class SubscriptionServiceImpl implements SubscriptionService {
  private static readonly CONFIRMATION_TTL_MS = 60_000;
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

    if (existingSubscription?.status === SubscriptionStatus.Confirmed) {
      throw new AlreadySubscribedError(
        validatedEmail.value,
        validatedRepo.toString(),
      );
    }

    const confirmToken = SubscriptionToken.issue({
      value: this.tokenGenerator.generate(),
      scope: SubscriptionTokenScope.Confirm,
      issuedAt: this.clock.now(),
      ttlMs: SubscriptionServiceImpl.CONFIRMATION_TTL_MS,
    });

    let subscription: Subscription;
    if (existingSubscription) {
      if (existingSubscription.status === SubscriptionStatus.Unsubscribed) {
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
      email: validatedEmail.value,
      repo: validatedRepo.toString(),
    });

    this.logger.info('User subscribed', {
      email: validatedEmail.value,
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
      SubscriptionTokenScope.Confirm,
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError();
    }

    const now = this.clock.now();
    const unsubscribeToken = SubscriptionToken.issue({
      value: this.tokenGenerator.generate(),
      scope: SubscriptionTokenScope.Unsubscribe,
      issuedAt: now,
      ttlMs: SubscriptionServiceImpl.UNSUBSCRIBE_TTL_MS,
    });

    subscription.confirm(token, now, unsubscribeToken);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });

    await this.notificationService.notifySubscriptionConfirmed({
      email: subscription.email.value,
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
      SubscriptionTokenScope.Unsubscribe,
    );

    if (!subscription) {
      throw new SubscriptionNotFoundError();
    }

    subscription.unsubscribe(token, this.clock.now());

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });

    this.logger.info('User unsubscribed', {
      subscriptionId: subscription.id,
    });
  }
}
