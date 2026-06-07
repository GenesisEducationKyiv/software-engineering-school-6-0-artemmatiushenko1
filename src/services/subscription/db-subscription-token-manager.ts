import { randomUUID } from 'crypto';
import type { SubscriptionTokenManager } from '../../domain/subscription-token-manager.js';
import type {
  SubscriptionToken,
  SubscriptionTokenScope,
} from '../../domain/subscription.js';
import type { SubscriptionRepository } from '../../domain/subscription.repository.js';
import type { DomainTransaction } from '../../domain/transaction-manager.js';

export class DbSubscriptionTokenManager implements SubscriptionTokenManager {
  constructor(
    private subscriptionRepo: SubscriptionRepository,
    private tokenExpiryHours: number = 24,
  ) {}

  async createToken(
    subscriptionId: number,
    scope: SubscriptionTokenScope,
    tx?: DomainTransaction,
  ): Promise<string> {
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.tokenExpiryHours);

    await this.subscriptionRepo.createToken(
      {
        subscriptionId,
        token,
        scope,
        expiresAt,
      },
      tx,
    );

    return token;
  }

  async getTokenByValue(token: string): Promise<SubscriptionToken | null> {
    return this.subscriptionRepo.findTokenByValue(token);
  }

  async getTokenBySubscriptionIdAndScope(
    subscriptionId: number,
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
