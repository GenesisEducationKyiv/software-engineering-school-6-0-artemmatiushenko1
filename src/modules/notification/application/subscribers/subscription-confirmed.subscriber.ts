import type { NotificationService } from '../../api/notification.service.js';
import type { SubscriptionConfirmedEvent } from '../../../subscription/api/events.js';

export class SubscriptionConfirmedSubscriber {
  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: SubscriptionConfirmedEvent): Promise<void> {
    await this.notificationService.notifySubscriptionConfirmed({
      email: event.payload.email,
      repo: event.payload.repo,
      unsubscribeToken: event.payload.unsubscribeToken,
    });
  }
}
