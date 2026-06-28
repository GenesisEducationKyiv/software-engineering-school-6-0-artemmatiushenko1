import type { SubscriptionConfirmedEvent } from '../../../subscription/api/events.js';
import { Email, Recipient } from '../../domain/index.js';
import { buildUnsubscribeUrl } from '../links.js';
import { subscriptionConfirmedTemplate } from '../templates.js';
import type { EmailClient } from '../ports/email-client.js';
import type { NotificationMetrics } from '../ports/notification-metrics.js';
import type { RecipientRepository } from '../ports/recipient.repository.js';

export class SubscriptionConfirmedSubscriber {
  constructor(
    private readonly recipientRepository: RecipientRepository,
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    private readonly metrics?: NotificationMetrics,
  ) {}

  async handle(event: SubscriptionConfirmedEvent): Promise<void> {
    const recipient = Recipient.create(
      event.aggregateId,
      Email.fromString(event.payload.email),
      event.payload.unsubscribeToken,
    );
    await this.recipientRepository.save(recipient);

    const unsubscribeUrl = buildUnsubscribeUrl(
      this.appUrl,
      event.payload.unsubscribeToken,
    );
    const template = subscriptionConfirmedTemplate(
      event.payload.repo,
      unsubscribeUrl,
    );

    await this.emailClient.sendEmail({
      to: event.payload.email,
      ...template,
    });

    this.metrics?.incrementNotificationsSent();
  }
}
