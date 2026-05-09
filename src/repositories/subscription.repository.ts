import { db } from '../db/index.js';
import type {
  Database,
  Transaction as DrizzleTransaction,
} from '../db/index.js';
import { subscriptions, subscriptionTokens } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  SubscriptionSchema,
  SubscriptionTokenSchema,
} from '../domain/subscription.js';
import type {
  Subscription,
  SubscriptionToken,
  SubscriptionTokenScope,
} from '../domain/subscription.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import type { DomainTransaction } from '../domain/transaction-manager.js';

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  private getDb(tx?: DomainTransaction): Database | DrizzleTransaction {
    return (tx as unknown as DrizzleTransaction) ?? db;
  }

  async createSubscription(
    data: { email: string; repo: string },
    tx?: DomainTransaction,
  ): Promise<Subscription> {
    const [result] = await this.getDb(tx)
      .insert(subscriptions)
      .values({
        email: data.email,
        repo: data.repo,
        confirmed: false,
      })
      .returning();

    return SubscriptionSchema.parse(result);
  }

  async findByEmailAndRepo(
    email: string,
    repo: string,
  ): Promise<Subscription | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.email, email), eq(subscriptions.repo, repo)))
      .limit(1);

    return result ? SubscriptionSchema.parse(result) : null;
  }

  async findSubscriptionById(id: number): Promise<Subscription | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    return result ? SubscriptionSchema.parse(result) : null;
  }

  async findConfirmedSubscriptionsByEmail(
    email: string,
  ): Promise<Subscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(
        and(eq(subscriptions.email, email), eq(subscriptions.confirmed, true)),
      );

    return results.map((r) => SubscriptionSchema.parse(r));
  }

  async findAllConfirmedSubscriptions(): Promise<Subscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.confirmed, true));

    return results.map((r) => SubscriptionSchema.parse(r));
  }

  async findSubscriptionsByEmail(email: string): Promise<Subscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.email, email));

    return results.map((r) => SubscriptionSchema.parse(r));
  }

  async confirmSubscription(id: number, tx?: DomainTransaction): Promise<void> {
    await this.getDb(tx)
      .update(subscriptions)
      .set({ confirmed: true })
      .where(eq(subscriptions.id, id));
  }

  async updateLastSeenTag(
    id: number,
    tag: string,
    tx?: DomainTransaction,
  ): Promise<void> {
    await this.getDb(tx)
      .update(subscriptions)
      .set({ lastSeenTag: tag })
      .where(eq(subscriptions.id, id));
  }

  async deleteSubscription(id: number, tx?: DomainTransaction): Promise<void> {
    await this.getDb(tx).delete(subscriptions).where(eq(subscriptions.id, id));
  }

  async createToken(
    data: {
      subscriptionId: number;
      token: string;
      scope: SubscriptionTokenScope;
      expiresAt: Date;
    },
    tx?: DomainTransaction,
  ): Promise<SubscriptionToken> {
    const [result] = await this.getDb(tx)
      .insert(subscriptionTokens)
      .values({
        subscriptionId: data.subscriptionId,
        token: data.token,
        scope: data.scope,
        expiresAt: data.expiresAt,
      })
      .returning();

    return SubscriptionTokenSchema.parse(result);
  }

  async findToken(
    token: string,
    scope: SubscriptionTokenScope,
  ): Promise<SubscriptionToken | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptionTokens)
      .where(
        and(
          eq(subscriptionTokens.token, token),
          eq(subscriptionTokens.scope, scope),
        ),
      )
      .limit(1);

    if (!result) return null;

    return SubscriptionTokenSchema.parse(result);
  }

  async findTokenByValue(token: string): Promise<SubscriptionToken | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptionTokens)
      .where(eq(subscriptionTokens.token, token))
      .limit(1);

    if (!result) return null;

    return SubscriptionTokenSchema.parse(result);
  }

  async findTokenBySubscriptionIdAndScope(
    subscriptionId: number,
    scope: SubscriptionTokenScope,
  ): Promise<SubscriptionToken | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptionTokens)
      .where(
        and(
          eq(subscriptionTokens.subscriptionId, subscriptionId),
          eq(subscriptionTokens.scope, scope),
        ),
      )
      .limit(1);

    if (!result) return null;

    return SubscriptionTokenSchema.parse(result);
  }

  async deleteToken(token: string, tx?: DomainTransaction): Promise<void> {
    await this.getDb(tx)
      .delete(subscriptionTokens)
      .where(eq(subscriptionTokens.token, token));
  }
}
