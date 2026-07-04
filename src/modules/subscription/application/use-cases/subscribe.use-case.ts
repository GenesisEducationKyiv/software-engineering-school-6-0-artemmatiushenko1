import type { GithubClient } from '../../../github/api/github-client.interface.js';
import type { SubscriptionRepository } from '../ports/subscription.repository.js';
import {
  Subscription,
  SubscriptionToken,
  SubscriptionTokenScope,
  SubscriptionStatus,
} from '../../domain/index.js';
import { RepoNotFoundError, AlreadySubscribedError } from '../errors.js';
import { Email, RepoPath } from '../../../../shared-kernel/index.js';
import type { TokenGenerator } from '../ports/token-generator.js';
import type {
  Clock,
  IdGenerator,
  Logger,
  TransactionManager,
} from '../../../../shared-kernel/index.js';
import type { EventBus } from '../../../../platform/event-bus/event-bus.interface.js';
import { toPublicApiEvents } from '../subscription-event.mapper.js';

export class SubscribeUseCase {
  private static readonly CONFIRMATION_TTL_MS = 60_000;

  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private githubClient: GithubClient,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private idGenerator: IdGenerator,
    private tokenGenerator: TokenGenerator,
    private clock: Clock,
    private eventBus: EventBus,
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
        existingSubscription.reactivate(confirmToken, this.clock.now());
      } else {
        existingSubscription.renewConfirmation(confirmToken, this.clock.now());
      }
      subscription = existingSubscription;
    } else {
      subscription = Subscription.request(
        this.idGenerator.next(),
        validatedEmail,
        validatedRepo,
        confirmToken,
        this.clock.now(),
      );
    }

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });

    const events = toPublicApiEvents(subscription.pullEvents());
    if (events.length > 0) {
      await this.eventBus.publish(events);
    }

    this.logger.info('User subscribed', {
      email: validatedEmail.value,
      repoPath: validatedRepo.toString(),
    });
  }
}
