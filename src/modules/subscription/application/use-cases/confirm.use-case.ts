import type { SubscriptionRepository } from '../ports/subscription.repository.js';
import {
  SubscriptionToken,
  SubscriptionTokenScope,
} from '../../domain/index.js';
import { SubscriptionNotFoundError } from '../errors.js';
import type { TokenGenerator } from '../ports/token-generator.js';
import type {
  Logger,
  TransactionManager,
} from '../../../../shared-kernel/index.js';
import type { Outbox } from '../../../../platform/outbox/outbox.js';
import { toPublicApiEvents } from '../subscription-event.mapper.js';
import type { Clock } from '../../../../shared-kernel/clock.js';

export class ConfirmUseCase {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private tokenGenerator: TokenGenerator,
    private clock: Clock,
    private outbox: Outbox,
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
    });

    subscription.confirm(token, now, unsubscribeToken);

    await this.transactionManager.run(async (tx) => {
      await this.subscriptionRepo.save(subscription, tx);
      const integrationEvents = toPublicApiEvents(subscription.pullEvents());
      if (integrationEvents.length > 0) {
        await this.outbox.save(integrationEvents, tx);
      }
    });

    this.logger.info('Subscription confirmed', {
      subscriptionId: subscription.id,
    });
  }
}
