import type { NotificationService } from '../../api/notification.service.js';
import type { SubscriptionReactivatedEvent } from '../../../subscription/api/events.js';

export class SubscriptionReactivatedSubscriber {
  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: SubscriptionReactivatedEvent): Promise<void> {
    await this.notificationService.notifySubscriptionConfirmation({
      email: event.payload.email,
      repo: event.payload.repo,
      confirmToken: event.payload.confirmationToken,
    });
  }
}
