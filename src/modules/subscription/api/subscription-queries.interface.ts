import type { Subscription } from '../domain/subscription.js';

export interface SubscriptionQueries {
  findAllConfirmedSubscriptions(): Promise<Subscription[]>;

  observeNewRelease(subscriptionId: string, tag: string): Promise<void>;
}
