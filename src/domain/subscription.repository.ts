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
  createSubscription(
    data: { email: string; repo: string },
    tx?: DomainTransaction,
  ): Promise<SubscriptionRow>;

  findByEmailAndRepo(
    email: Email,
    repoPath: RepoPath,
  ): Promise<Subscription | null>;

  findSubscriptionById(id: number): Promise<SubscriptionRow | null>;

  findConfirmedSubscriptionsByEmail(email: string): Promise<SubscriptionRow[]>;

  findAllConfirmedSubscriptions(): Promise<SubscriptionRow[]>;

  findSubscriptionsByEmail(email: string): Promise<SubscriptionRow[]>;

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
