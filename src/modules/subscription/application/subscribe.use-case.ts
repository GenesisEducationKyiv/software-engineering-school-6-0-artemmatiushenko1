import type { GithubClient } from '../../../domain/github.js';
import type { SubscriptionRepository } from './ports/subscription.repository.js';
import type { NotificationService } from '../../notification/api/notification.service.js';
import {
  Subscription,
  SubscriptionToken,
  SubscriptionTokenScope,
  SubscriptionStatus,
} from '../domain/index.js';
import { RepoNotFoundError, AlreadySubscribedError } from './errors.js';
import { Email } from '../domain/email.js';
import { RepoPath } from '../domain/repo-path.js';
import type { TokenGenerator } from './ports/token-generator.js';
import type {
  Clock,
  IdGenerator,
  Logger,
  TransactionManager,
} from '../../../shared-kernel/index.js';

export class SubscribeUseCase {
  private static readonly CONFIRMATION_TTL_MS = 60_000;

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

  async execute(email: string, repoPath: string): Promise<void> {
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
      ttlMs: SubscribeUseCase.CONFIRMATION_TTL_MS,
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
}
