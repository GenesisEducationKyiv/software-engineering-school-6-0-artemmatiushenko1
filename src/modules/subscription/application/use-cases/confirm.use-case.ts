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
import { toPublicApiEvents } from '../subscription-event.mapper.js';

export class ConfirmUseCase {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private tokenGenerator: TokenGenerator,
    private clock: Clock,
    private eventBus: EventBus,
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
