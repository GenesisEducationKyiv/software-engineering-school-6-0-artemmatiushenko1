import type { Database } from '../../platform/db/types.js';
import type { GithubClient } from '../github/api/github-client.interface.js';
import type { NotificationService } from '../notification/api/notification.service.js';
import type { Clock } from '../../shared-kernel/clock.js';
import type { IdGenerator } from '../../shared-kernel/id-generator.js';
import type { Logger } from '../../shared-kernel/logger.js';
import { DrizzleTransactionManager } from '../../platform/db/drizzle-transaction-manager.js';
import type { SubscriptionQueries } from './api/subscription-queries.interface.js';
import { ConfirmUseCase } from './application/confirm.use-case.js';
import { GetSubscriptionsByEmailUseCase } from './application/get-subscriptions-by-email.use-case.js';
import type { TokenGenerator } from './application/ports/token-generator.js';
import { SubscribeUseCase } from './application/subscribe.use-case.js';
import { SubscriptionQueriesImpl } from './application/subscription-queries.js';
import { UnsubscribeUseCase } from './application/unsubscribe.use-case.js';
import { DrizzleSubscriptionRepository } from './infrastructure/subscription.repository.js';

export interface SubscriptionModuleDeps {
  db: Database;
  githubClient: GithubClient;
  notificationService: NotificationService;
  logger: Logger;
  clock: Clock;
  idGenerator: IdGenerator;
  tokenGenerator: TokenGenerator;
}

export class SubscriptionModule {
  private readonly subscriptionRepo: DrizzleSubscriptionRepository;
  private readonly transactionManager: DrizzleTransactionManager;

  readonly subscriptionQueries: SubscriptionQueries;
  readonly subscribeUseCase: SubscribeUseCase;
  readonly confirmUseCase: ConfirmUseCase;
  readonly unsubscribeUseCase: UnsubscribeUseCase;
  readonly getSubscriptionsByEmailUseCase: GetSubscriptionsByEmailUseCase;

  private constructor(private readonly deps: SubscriptionModuleDeps) {
    this.subscriptionRepo = new DrizzleSubscriptionRepository(this.deps.db);
    this.transactionManager = new DrizzleTransactionManager(this.deps.db);
    this.subscriptionQueries = new SubscriptionQueriesImpl(
      this.subscriptionRepo,
      this.transactionManager,
    );
    this.subscribeUseCase = new SubscribeUseCase(
      this.subscriptionRepo,
      this.deps.githubClient,
      this.deps.notificationService,
      this.transactionManager,
      this.deps.logger,
      this.deps.idGenerator,
      this.deps.tokenGenerator,
      this.deps.clock,
    );
    this.confirmUseCase = new ConfirmUseCase(
      this.subscriptionRepo,
      this.deps.notificationService,
      this.transactionManager,
      this.deps.logger,
      this.deps.tokenGenerator,
      this.deps.clock,
    );
    this.unsubscribeUseCase = new UnsubscribeUseCase(
      this.subscriptionRepo,
      this.transactionManager,
      this.deps.logger,
      this.deps.clock,
    );
    this.getSubscriptionsByEmailUseCase = new GetSubscriptionsByEmailUseCase(
      this.subscriptionRepo,
    );
  }

  static create(deps: SubscriptionModuleDeps): SubscriptionModule {
    return new SubscriptionModule(deps);
  }
}
