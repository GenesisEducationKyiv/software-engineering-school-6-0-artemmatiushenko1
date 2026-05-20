import type {
  Subscription,
  SubscriptionToken,
  SubscriptionTokenScope,
} from './subscription.js';
import type { DomainTransaction } from './transaction-manager.js';

export interface SubscriptionRepository {
  createSubscription(
    data: { email: string; repo: string },
    tx?: DomainTransaction,
  ): Promise<Subscription>;

  findByEmailAndRepo(email: string, repo: string): Promise<Subscription | null>;

  findSubscriptionById(id: number): Promise<Subscription | null>;

  findConfirmedSubscriptionsByEmail(email: string): Promise<Subscription[]>;

  findAllConfirmedSubscriptions(): Promise<Subscription[]>;

  findSubscriptionsByEmail(email: string): Promise<Subscription[]>;

  confirmSubscription(id: number, tx?: DomainTransaction): Promise<void>;

  updateLastSeenTag(
    id: number,
    tag: string,
    tx?: DomainTransaction,
  ): Promise<void>;

  deleteSubscription(id: number, tx?: DomainTransaction): Promise<void>;

  createToken(
    data: {
      subscriptionId: number;
      token: string;
      scope: SubscriptionTokenScope;
      expiresAt: Date;
    },
    tx?: DomainTransaction,
  ): Promise<SubscriptionToken>;

  findToken(
    token: string,
    scope: SubscriptionTokenScope,
  ): Promise<SubscriptionToken | null>;

  findTokenByValue(token: string): Promise<SubscriptionToken | null>;

  findTokenBySubscriptionIdAndScope(
    subscriptionId: number,
    scope: SubscriptionTokenScope,
  ): Promise<SubscriptionToken | null>;

  deleteToken(token: string, tx?: DomainTransaction): Promise<void>;
}
