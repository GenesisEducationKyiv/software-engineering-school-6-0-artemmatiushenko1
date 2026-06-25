import type { EmailClient } from './ports/email-client.js';
import type {
  NotificationService,
  NewReleaseNotificationContext,
  SubscriptionConfirmationContext,
  SubscriptionConfirmedContext,
} from '../api/notification.service.js';
import {
  newReleaseNotificationTemplate,
  subscriptionConfirmationTemplate,
  subscriptionConfirmedTemplate,
} from '../infrastructure/templates.js';
import {
  buildConfirmUrl,
  buildUnsubscribeUrl,
} from '../infrastructure/links.js';
import type { Metrics } from '../../../infrastructure/metrics/metrics.interface.js';

export class NotificationServiceImpl implements NotificationService {
  constructor(
    private emailClient: EmailClient,
    private appUrl: string,
    private metrics?: Metrics,
  ) {}

  async notifySubscriptionConfirmation(
    context: SubscriptionConfirmationContext,
  ): Promise<void> {
    const confirmUrl = buildConfirmUrl(this.appUrl, context.confirmToken);
    const template = subscriptionConfirmationTemplate(context.repo, confirmUrl);

    await this.emailClient.sendEmail({
      to: context.email,
      ...template,
    });
  }

  async notifySubscriptionConfirmed(
    context: SubscriptionConfirmedContext,
  ): Promise<void> {
    const unsubscribeUrl = buildUnsubscribeUrl(
      this.appUrl,
      context.unsubscribeToken,
    );
    const template = subscriptionConfirmedTemplate(
      context.repo,
      unsubscribeUrl,
    );

    await this.emailClient.sendEmail({
      to: context.email,
      ...template,
    });
  }

  async notifyNewRelease(
    context: NewReleaseNotificationContext,
  ): Promise<void> {
    const unsubscribeUrl = buildUnsubscribeUrl(
      this.appUrl,
      context.unsubscribeToken,
    );

    const template = newReleaseNotificationTemplate(
      context.repo,
      context.tag,
      context.releaseName,
      unsubscribeUrl,
    );

    await this.emailClient.sendEmail({
      to: context.email,
      ...template,
    });

    this.metrics?.incrementNotificationsSent();
  }
}
