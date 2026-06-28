import type { SubscriptionRepository } from '../ports/subscription.repository.js';
import {
  SubscriptionToken,
  SubscriptionTokenScope,
} from '../../domain/index.js';
import { SubscriptionNotFoundError } from '../errors.js';
import type { TokenGenerator } from '../ports/token-generator.js';
import type {
  Clock,
  Logger,
  TransactionManager,
} from '../../../../shared-kernel/index.js';
import type { EventBus } from '../../../../platform/event-bus/event-bus.interface.js';
import type { GithubClient } from '../../../github/api/github-client.interface.js';
import { ReleaseTag } from '../../../../shared-kernel/index.js';
import { toPublicApiEvents } from '../subscription-event.mapper.js';

export class ConfirmUseCase {
  private static readonly UNSUBSCRIBE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private tokenGenerator: TokenGenerator,
    private clock: Clock,
    private eventBus: EventBus,
    private githubClient: GithubClient,
  ) {}

  async execute(token: string): Promise<void> {
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
      ttlMs: ConfirmUseCase.UNSUBSCRIBE_TTL_MS,
    });

    const latestRelease = await this.githubClient.getLatestRelease(
      subscription.repoPath.owner,
      subscription.repoPath.repo,
    );
    const baselineTag = latestRelease
      ? ReleaseTag.fromString(latestRelease.tag)
      : null;

    subscription.confirm(token, now, unsubscribeToken, baselineTag);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
    });

    const integrationEvents = toPublicApiEvents(subscription.pullEvents());
    if (integrationEvents.length > 0) {
      await this.eventBus.publish(integrationEvents);
    }

    this.logger.info('Subscription confirmed', {
      subscriptionId: subscription.id,
    });
  }
}
