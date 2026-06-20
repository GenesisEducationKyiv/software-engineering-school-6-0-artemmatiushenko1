import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type {
  SubscriptionToken,
  SubscriptionTokenScope,
} from '../../domain/subscription.js';
import type { DomainTransaction } from '../../domain/transaction-manager.js';

export class SubscriptionTokenManager {
  constructor(private subscriptionRepo: SubscriptionRepository) {}

  async getTokenByValue(token: string): Promise<SubscriptionToken | null> {
    return this.subscriptionRepo.findTokenByValue(token);
  }

  async getTokenBySubscriptionIdAndScope(
    subscriptionId: string,
    scope: SubscriptionTokenScope,
  ): Promise<SubscriptionToken | null> {
    return this.subscriptionRepo.findTokenBySubscriptionIdAndScope(
      subscriptionId,
      scope,
    );
  }

  async validateToken(
    token: SubscriptionToken,
    scope: SubscriptionTokenScope,
    tx?: DomainTransaction,
  ): Promise<boolean> {
    if (token.scope !== scope) {
      return false;
    }

    if (token.expiresAt < new Date()) {
      await this.invalidateToken(token.token, tx);
      return false;
    }

    return true;
  }

  async invalidateToken(token: string, tx?: DomainTransaction): Promise<void> {
    await this.subscriptionRepo.deleteToken(token, tx);
  }
}
