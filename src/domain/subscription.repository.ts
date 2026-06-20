import type { Subscription } from './subscription/subscription.js';
import type { Email } from './subscription/email.js';
import type { RepoPath } from './subscription/repo-path.js';
import type {
  Subscription as SubscriptionRow,
  SubscriptionToken,
  SubscriptionTokenScope,
} from './subscription.js';
import type { DomainTransaction } from './transaction-manager.js';

export interface SubscriptionRepository {
  findByEmailAndRepo(
    email: Email,
    repoPath: RepoPath,
  ): Promise<Subscription | null>;

  findByToken(
    tokenValue: string,
    scope: SubscriptionTokenScope,
  ): Promise<Subscription | null>;

  save(subscription: Subscription, tx?: DomainTransaction): Promise<void>;

  findSubscriptionById(id: string): Promise<SubscriptionRow | null>;

  findConfirmedSubscriptionsByEmail(email: string): Promise<SubscriptionRow[]>;

  findAllConfirmedSubscriptions(): Promise<Subscription[]>;

  findSubscriptionsByEmail(email: string): Promise<SubscriptionRow[]>;

  confirmSubscription(id: string, tx?: DomainTransaction): Promise<void>;

  updateLastSeenTag(
    id: string,
    tag: string,
    tx?: DomainTransaction,
  ): Promise<void>;

  deleteSubscription(id: string, tx?: DomainTransaction): Promise<void>;

  createToken(
    data: {
      subscriptionId: string;
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
    subscriptionId: string,
    scope: SubscriptionTokenScope,
  ): Promise<SubscriptionToken | null>;

  deleteToken(token: string, tx?: DomainTransaction): Promise<void>;
}
