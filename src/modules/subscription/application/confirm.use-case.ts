import type { SubscriptionRepository } from './ports/subscription.repository.js';
import type { NotificationService } from '../../notification/api/notification.service.js';
import { SubscriptionToken, SubscriptionTokenScope } from '../domain/index.js';
import { SubscriptionNotFoundError } from './errors.js';
import type { TokenGenerator } from './ports/token-generator.js';
import type {
  Logger,
  TransactionManager,
} from '../../../shared-kernel/index.js';
import type { Clock } from '../../../shared-kernel/clock.js';

export class ConfirmUseCase {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private notificationService: NotificationService,
    private transactionManager: TransactionManager,
    private logger: Logger,
    private tokenGenerator: TokenGenerator,
    private clock: Clock,
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

    await this.notificationService.notifySubscriptionConfirmed({
      email: subscription.email.value,
      repo: subscription.repoPath.toString(),
      unsubscribeToken: unsubscribeToken.value,
    });

    this.logger.info('Subscription confirmed', {
      subscriptionId: subscription.id,
    });
  }
}
