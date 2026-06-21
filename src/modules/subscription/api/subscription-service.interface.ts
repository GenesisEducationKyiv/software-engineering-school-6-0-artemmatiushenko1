import type { Subscription } from '../domain/subscription.js';

export interface SubscriptionService {
  subscribe(email: string, repoPath: string): Promise<void>;

  getSubscriptionsByEmail(email: string): Promise<Subscription[]>;

  findAllConfirmedSubscriptions(): Promise<Subscription[]>;

  observeNewRelease(subscriptionId: string, tag: string): Promise<void>;

  confirm(token: string): Promise<void>;

  unsubscribe(token: string): Promise<void>;
}
