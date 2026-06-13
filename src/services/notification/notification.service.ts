import type { EmailClient } from '../../domain/email.js';
import {
  newReleaseNotificationTemplate,
  subscriptionConfirmationTemplate,
  subscriptionConfirmedTemplate,
} from './templates.js';
import type { Metrics } from '../../domain/metrics.js';

export type NewReleaseNotificationContext = {
  email: string;
  repo: string;
  tag: string;
  releaseName: string | null;
  unsubscribeToken: string;
};

export type SubscriptionConfirmationContext = {
  email: string;
  repo: string;
  confirmToken: string;
};

export type SubscriptionConfirmedContext = {
  email: string;
  repo: string;
  unsubscribeToken: string;
};

export class NotificationService {
  constructor(
    private emailClient: EmailClient,
    private appUrl: string,
    private metrics?: Metrics,
  ) {}

  async notifySubscriptionConfirmation(
    context: SubscriptionConfirmationContext,
  ): Promise<void> {
    const confirmUrl = `${this.appUrl}/confirm/${context.confirmToken}`;
    const template = subscriptionConfirmationTemplate(context.repo, confirmUrl);

    await this.emailClient.sendEmail({
      to: context.email,
      ...template,
    });
  }

  async notifySubscriptionConfirmed(
    context: SubscriptionConfirmedContext,
  ): Promise<void> {
    const unsubscribeUrl = `${this.appUrl}/unsubscribe/${context.unsubscribeToken}`;
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
    const unsubscribeUrl = `${this.appUrl}/unsubscribe/${context.unsubscribeToken}`;

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

    this.metrics?.incrementNotificationsSent(context.repo);
  }
}
