import type { Database } from '../../platform/db/types.js';
import type { GithubClient } from '../github/api/github-client.interface.js';
import type { Clock } from '../../shared-kernel/clock.js';
import type { IdGenerator } from '../../shared-kernel/id-generator.js';
import type { Logger } from '../../shared-kernel/logger.js';
import { DrizzleTransactionManager } from '../../platform/db/drizzle-transaction-manager.js';
import { ConfirmUseCase } from './application/use-cases/confirm.use-case.js';
import { GetSubscriptionsByEmailUseCase } from './application/use-cases/get-subscriptions-by-email.use-case.js';
import type { TokenGenerator } from './application/ports/token-generator.js';
import { SubscribeUseCase } from './application/use-cases/subscribe.use-case.js';
import { UnsubscribeUseCase } from './application/use-cases/unsubscribe.use-case.js';
import { DrizzleSubscriptionRepository } from './infrastructure/subscription.repository.js';
import type { EventBus } from '../../platform/event-bus/event-bus.interface.js';

export interface SubscriptionModuleDeps {
  db: Database;
  githubClient: GithubClient;
  logger: Logger;
  clock: Clock;
  idGenerator: IdGenerator;
  tokenGenerator: TokenGenerator;
  eventBus: EventBus;
}

export class SubscriptionModule {
  readonly subscribeUseCase: SubscribeUseCase;
  readonly confirmUseCase: ConfirmUseCase;
  readonly unsubscribeUseCase: UnsubscribeUseCase;
  readonly getSubscriptionsByEmailUseCase: GetSubscriptionsByEmailUseCase;

  private constructor(deps: SubscriptionModuleDeps) {
    const subscriptionRepo = new DrizzleSubscriptionRepository(deps.db);
    const transactionManager = new DrizzleTransactionManager(deps.db);

    this.subscribeUseCase = new SubscribeUseCase(
      subscriptionRepo,
      deps.githubClient,
      transactionManager,
      deps.logger,
      deps.idGenerator,
      deps.tokenGenerator,
      deps.clock,
      deps.eventBus,
    );
    this.confirmUseCase = new ConfirmUseCase(
      subscriptionRepo,
      transactionManager,
      deps.logger,
      deps.tokenGenerator,
      deps.clock,
      deps.eventBus,
      deps.githubClient,
    );
    this.unsubscribeUseCase = new UnsubscribeUseCase(
      subscriptionRepo,
      transactionManager,
      deps.logger,
      deps.clock,
      deps.eventBus,
    );
    this.getSubscriptionsByEmailUseCase = new GetSubscriptionsByEmailUseCase(
      subscriptionRepo,
    );
  }

  static create(deps: SubscriptionModuleDeps): SubscriptionModule {
    return new SubscriptionModule(deps);
  }
}
