import { z } from 'zod';
import type { SubscriptionRow } from '../services/subscription/subscription-row.mapper.js';
import type {
  SubscriptionTokenRow,
  SubscriptionTokenScope,
} from '../services/subscription/subscription-token-row.mapper.js';

export const RepoPathSchema = z
  .string()
  .regex(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/, {
    message: "Invalid repository format. Expected 'owner/repo'",
  });

export type Subscription = SubscriptionRow;
export type SubscriptionToken = SubscriptionTokenRow;
export type { SubscriptionTokenScope };

export interface SubscriptionService {
  subscribe(email: string, repoPath: string): Promise<Subscription>;

  getSubscriptionsByEmail(email: string): Promise<Subscription[]>;

  findAllConfirmedSubscriptions(): Promise<Subscription[]>;

  findSubscriptionById(id: number): Promise<Subscription | null>;

  updateLastSeenTag(id: number, tag: string): Promise<void>;

  getUnsubscribeToken(
    subscriptionId: number,
  ): Promise<SubscriptionToken | null>;

  confirmSubscription(tokenValue: string): Promise<void>;

  unsubscribe(tokenValue: string): Promise<void>;
}
