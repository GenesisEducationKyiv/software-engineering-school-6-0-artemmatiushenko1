import type {
  SubscriptionToken,
  SubscriptionTokenScope,
} from './subscription.js';
import type { DomainTransaction } from './transaction-manager.js';

export interface SubscriptionTokenManager {
  createToken(
    subscriptionId: number,
    scope: SubscriptionTokenScope,
    tx?: DomainTransaction,
  ): Promise<string>;
  getTokenByValue(
    token: string,
    tx?: DomainTransaction,
  ): Promise<SubscriptionToken | null>;
  getTokenBySubscriptionIdAndScope(
    subscriptionId: number,
    scope: SubscriptionTokenScope,
    tx?: DomainTransaction,
  ): Promise<SubscriptionToken | null>;
  validateToken(
    token: SubscriptionToken,
    scope: SubscriptionTokenScope,
    tx?: DomainTransaction,
  ): Promise<boolean>;
  invalidateToken(token: string, tx?: DomainTransaction): Promise<void>;
}
