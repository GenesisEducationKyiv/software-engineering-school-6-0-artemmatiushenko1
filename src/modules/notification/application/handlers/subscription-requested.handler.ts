import type { NotificationService } from '../../api/notification.service.js';
import type { SubscriptionRequestedEvent } from '../../../subscription/api/events.js';

// TODO: rename to subscriber
export class SubscriptionRequestedHandler {
  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: SubscriptionRequestedEvent): Promise<void> {
    await this.notificationService.notifySubscriptionConfirmation({
      email: event.payload.email,
      repo: event.payload.repo,
      confirmToken: event.payload.confirmationToken,
    });
  }
}
