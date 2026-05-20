import type { EmailService } from '../domain/email.js';
import type { SubscriptionTokenManager } from '../domain/subscription-token-manager.js';
import type { Subscription } from '../domain/subscription.js';
import type { GithubRelease } from '../domain/github.js';
import { TokenNotFoundError } from '../domain/errors.js';
import type { Logger } from '../domain/logger.js';
import { newReleaseNotificationTemplate } from '../infrastructure/email/templates.js';
import type { Metrics } from '../domain/metrics.js';

export class NotificationService {
  constructor(
    private emailService: EmailService,
    private tokenManager: SubscriptionTokenManager,
    private logger: Logger,
    private appUrl: string,
    private metrics?: Metrics,
  ) {}

  async notifyNewRelease(
    subscription: Subscription,
    release: GithubRelease,
  ): Promise<void> {
    const unsubscribeToken =
      await this.tokenManager.getTokenBySubscriptionIdAndScope(
        subscription.id,
        'unsubscribe',
      );

    if (!unsubscribeToken) {
      this.logger.error(
        `No unsubscribe token found for subscription ${subscription.id}`,
      );
      throw new TokenNotFoundError();
    }

    const unsubscribeUrl = `${this.appUrl}/unsubscribe/${unsubscribeToken.token}`;

    const template = newReleaseNotificationTemplate(
      subscription.repo,
      release.tag,
      release.name,
      unsubscribeUrl,
    );

    await this.emailService.sendEmail({
      to: subscription.email,
      ...template,
    });

    this.metrics?.incrementNotificationsSent(subscription.repo);
  }
}
