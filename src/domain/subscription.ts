import type { Subscription } from './subscription/subscription.js';

export interface SubscriptionService {
  subscribe(email: string, repoPath: string): Promise<void>;

  getSubscriptionsByEmail(email: string): Promise<Subscription[]>;

  findAllConfirmedSubscriptions(): Promise<Subscription[]>;

  observeNewRelease(subscriptionId: string, tag: string): Promise<void>;

  confirm(tokenValue: string): Promise<void>;

  unsubscribe(tokenValue: string): Promise<void>;
}
