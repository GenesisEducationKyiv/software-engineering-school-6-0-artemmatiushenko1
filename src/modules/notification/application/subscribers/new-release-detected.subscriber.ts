import type { NotificationService } from '../notification.service.js';
import type { NewReleaseDetectedEvent } from '../../../scanner/api/events.js';

export class NewReleaseDetectedSubscriber {
  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: NewReleaseDetectedEvent): Promise<void> {
    await this.notificationService.notifyNewRelease({
      email: event.payload.email,
      repo: event.payload.repo,
      tag: event.payload.tag,
      releaseName: event.payload.releaseName,
      unsubscribeToken: event.payload.unsubscribeToken,
    });
  }
}
