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

import type { EventBus } from '../../../platform/event-bus/event-bus.interface.js';

export interface NotificationService {
  registerEventSubscribers(eventBus: EventBus): void;

  notifySubscriptionConfirmation(
    context: SubscriptionConfirmationContext,
  ): Promise<void>;

  notifySubscriptionConfirmed(
    context: SubscriptionConfirmedContext,
  ): Promise<void>;

  notifyNewRelease(context: NewReleaseNotificationContext): Promise<void>;
}
