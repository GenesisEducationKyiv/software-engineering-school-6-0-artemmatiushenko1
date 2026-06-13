import type { EmailClient } from '../../domain/email.js';
import { newReleaseNotificationTemplate } from '../../infrastructure/email/templates.js';
import type { Metrics } from '../../domain/metrics.js';

export type NewReleaseNotificationContext = {
  email: string;
  repo: string;
  tag: string;
  releaseName: string | null;
  unsubscribeToken: string;
};

export class NotificationService {
  constructor(
    private emailClient: EmailClient,
    private appUrl: string,
    private metrics?: Metrics,
  ) {}

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
