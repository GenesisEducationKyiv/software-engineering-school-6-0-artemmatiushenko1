import {
  ScannerEventType,
  type NewReleaseDetectedEvent,
} from '../../../scanner/api/events.js';
import { EventSubscriber } from '../../../../platform/event-bus/event-subscriber.js';
import { RecipientNotFoundError } from '../errors.js';
import { buildUnsubscribeUrl } from '../links.js';
import { newReleaseNotificationTemplate } from '../templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';

export class NewReleaseDetectedSubscriber extends EventSubscriber<NewReleaseDetectedEvent> {
  readonly eventType = ScannerEventType.NewReleaseDetected;

  constructor(
    private readonly recipientRepository: RecipientRepository,
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics: NotificationMetrics,
  ) {
    super();
  }

  async handle(event: NewReleaseDetectedEvent): Promise<void> {
    const recipient = await this.recipientRepository.findBySubscriptionId(
      event.aggregateId,
    );

    if (!recipient) {
      throw new RecipientNotFoundError(event.aggregateId);
    }

    const unsubscribeUrl = buildUnsubscribeUrl(
      this.appUrl,
      recipient.unsubscribeToken,
    );
    const template = newReleaseNotificationTemplate(
      event.payload.repo,
      event.payload.tag,
      event.payload.releaseName,
      unsubscribeUrl,
    );

    await this.emailClient.sendEmail({
      to: recipient.email.value,
      ...template,
    });

    this.metrics?.incrementNotificationsSent();
  }
}
