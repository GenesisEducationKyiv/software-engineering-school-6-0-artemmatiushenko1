import type { NotificationService } from '../notification.service.js';
import type { SubscriptionConfirmationRenewedEvent } from '../../../subscription/api/events.js';

export class SubscriptionConfirmationRenewedSubscriber {
  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: SubscriptionConfirmationRenewedEvent): Promise<void> {
    await this.notificationService.notifySubscriptionConfirmation({
      email: event.payload.email,
      repo: event.payload.repo,
      confirmToken: event.payload.confirmationToken,
    });
  }
}
