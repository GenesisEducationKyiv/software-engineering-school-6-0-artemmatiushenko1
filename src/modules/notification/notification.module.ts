import type { Database } from '../../platform/db/types.js';
import { NotificationEventSubscribers } from './application/notification-event-subscribers.js';
import type { EmailClient } from './application/ports/email-client.js';
import type { NotificationMetrics } from './application/ports/notification-metrics.js';
import { DrizzleRecipientRepository } from './infrastructure/recipient.repository.js';
import type { EventBus } from '../../platform/event-bus/event-bus.interface.js';

export interface NotificationModuleDeps {
  db: Database;
  emailClient: EmailClient;
  appUrl: string;
  metrics?: NotificationMetrics;
}

export class NotificationModule {
  private readonly eventSubscribers: NotificationEventSubscribers;

  private constructor(private readonly deps: NotificationModuleDeps) {
    const recipientRepository = new DrizzleRecipientRepository(deps.db);

    this.eventSubscribers = new NotificationEventSubscribers(
      recipientRepository,
      deps.emailClient,
      deps.appUrl,
      deps.metrics,
    );
  }

  registerEventSubscribers(eventBus: EventBus): void {
    this.eventSubscribers.register(eventBus);
  }

  static create(deps: NotificationModuleDeps): NotificationModule {
    return new NotificationModule(deps);
  }
}
