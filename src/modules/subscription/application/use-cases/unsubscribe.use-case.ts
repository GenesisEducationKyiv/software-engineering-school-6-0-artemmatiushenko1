import type { SubscriptionRepository } from '../ports/subscription.repository.js';
import { SubscriptionTokenScope } from '../../domain/index.js';
import { SubscriptionNotFoundError } from '../errors.js';
import type {
  Clock,
  Logger,
  TransactionManager,
} from '../../../../shared-kernel/index.js';
import type { EventBus } from '../../../../platform/event-bus/event-bus.interface.js';
import { toPublicApiEvents } from '../subscription-event.mapper.js';

export class UnsubscribeUseCase {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private clock: Clock,
    private eventBus: EventBus,
  ) {}

  async execute(token: string): Promise<void> {
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

    const integrationEvents = toPublicApiEvents(subscription.pullEvents());
    if (integrationEvents.length > 0) {
      await this.eventBus.publish(integrationEvents);
    }

    this.logger.info('User unsubscribed', {
      subscriptionId: subscription.id,
    });
  }
}
