import type { NotificationService } from './api/notification.service.js';
import { NotificationServiceImpl } from './application/notification.service.js';
import type { EmailClient } from './application/ports/email-client.js';
import type { NotificationMetrics } from './application/ports/notification-metrics.js';

export interface NotificationModuleDeps {
  emailClient: EmailClient;
  appUrl: string;
  metrics: NotificationMetrics;
}

export class NotificationModule {
  readonly notificationService: NotificationService;

  private constructor(private readonly deps: NotificationModuleDeps) {
    this.notificationService = new NotificationServiceImpl(
      this.deps.emailClient,
      this.deps.appUrl,
      this.deps.metrics,
    );
  }

  static create(deps: NotificationModuleDeps): NotificationModule {
    return new NotificationModule(deps);
  }
}
