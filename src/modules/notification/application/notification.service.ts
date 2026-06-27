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
import type { NotificationMetrics } from './ports/notification-metrics.js';
import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';
import { SubscriptionEventType } from '../../subscription/api/events.js';
import type { SubscriptionRequestedEvent } from '../../subscription/api/events.js';
import type { SubscriptionConfirmationRenewedEvent } from '../../subscription/api/events.js';
import type { SubscriptionReactivatedEvent } from '../../subscription/api/events.js';
import type { SubscriptionConfirmedEvent } from '../../subscription/api/events.js';
import { SubscriptionRequestedSubscriber } from './subscribers/subscription-requested.subscriber.js';
import { SubscriptionConfirmationRenewedSubscriber } from './subscribers/subscription-confirmation-renewed.subscriber.js';
import { SubscriptionReactivatedSubscriber } from './subscribers/subscription-reactivated.subscriber.js';
import { SubscriptionConfirmedSubscriber } from './subscribers/subscription-confirmed.subscriber.js';

export class NotificationServiceImpl implements NotificationService {
  constructor(
    private readonly emailClient: EmailClient,
    private readonly appUrl: string,
    eventBus: EventBus,
    private readonly metrics?: NotificationMetrics,
  ) {
    this.registerSubscribers(eventBus);
  }

  private registerSubscribers(eventBus: EventBus): void {
    const subscriptionRequestedSubscriber = new SubscriptionRequestedSubscriber(
      this,
    );
    const subscriptionConfirmationRenewedSubscriber =
      new SubscriptionConfirmationRenewedSubscriber(this);
    const subscriptionReactivatedSubscriber =
      new SubscriptionReactivatedSubscriber(this);
    const subscriptionConfirmedSubscriber = new SubscriptionConfirmedSubscriber(
      this,
    );

    eventBus.subscribe(
      SubscriptionEventType.Requested,
      (event: SubscriptionRequestedEvent) =>
        subscriptionRequestedSubscriber.handle(event),
    );

    eventBus.subscribe(
      SubscriptionEventType.ConfirmationRenewed,
      (event: SubscriptionConfirmationRenewedEvent) =>
        subscriptionConfirmationRenewedSubscriber.handle(event),
    );

    eventBus.subscribe(
      SubscriptionEventType.Reactivated,
      (event: SubscriptionReactivatedEvent) =>
        subscriptionReactivatedSubscriber.handle(event),
    );

    eventBus.subscribe(
      SubscriptionEventType.Confirmed,
      (event: SubscriptionConfirmedEvent) =>
        subscriptionConfirmedSubscriber.handle(event),
    );
  }

  async notifySubscriptionConfirmation(
    context: SubscriptionConfirmationContext,
  ): Promise<void> {
    const confirmUrl = buildConfirmUrl(this.appUrl, context.confirmToken);
    const template = subscriptionConfirmationTemplate(context.repo, confirmUrl);

    await this.emailClient.sendEmail({
      to: context.email,
      ...template,
    });

    this.metrics?.incrementNotificationsSent();
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

    this.metrics?.incrementNotificationsSent();
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
