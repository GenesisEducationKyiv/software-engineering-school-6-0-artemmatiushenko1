import { z } from 'zod';
import type { SubscriptionRow } from '../services/subscription/subscription-row.mapper.js';
import type {
  SubscriptionTokenRow,
  SubscriptionTokenScope,
} from '../services/subscription/subscription-token-row.mapper.js';
import type { Subscription as DomainSubscription } from './subscription/subscription.js';

export const RepoPathSchema = z
  .string()
  .regex(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/, {
    message: "Invalid repository format. Expected 'owner/repo'",
  });

export type Subscription = SubscriptionRow;
export type SubscriptionToken = SubscriptionTokenRow;
export type { SubscriptionTokenScope };

export interface SubscriptionService {
  subscribe(email: string, repoPath: string): Promise<void>;

  getSubscriptionsByEmail(email: string): Promise<DomainSubscription[]>;

  findAllConfirmedSubscriptions(): Promise<DomainSubscription[]>;

  updateLastSeenTag(id: string, tag: string): Promise<void>;

  confirmSubscription(tokenValue: string): Promise<void>;

  unsubscribe(tokenValue: string): Promise<void>;
}
