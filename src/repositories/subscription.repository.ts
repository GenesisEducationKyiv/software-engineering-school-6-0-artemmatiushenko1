import type {
  Database,
  Transaction as DrizzleTransaction,
} from '../db/types.js';
import { subscriptions, subscriptionTokens } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type {
  Subscription,
  SubscriptionToken,
  SubscriptionTokenScope,
} from '../domain/subscription.js';
import type { Subscription as DomainSubscription } from '../domain/subscription/subscription.js';
import type { Email } from '../domain/subscription/email.js';
import type { RepoPath } from '../domain/subscription/repo-path.js';
import {
  SubscriptionRowMapper,
  SubscriptionRowSchema,
  type SubscriptionRow,
} from '../services/subscription/subscription-row.mapper.js';
import {
  SubscriptionTokenRowMapper,
  SubscriptionTokenRowSchema,
} from '../services/subscription/subscription-token-row.mapper.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import type { DomainTransaction } from '../domain/transaction-manager.js';

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  private readonly subscriptionMapper = new SubscriptionRowMapper();
  private readonly tokenMapper = new SubscriptionTokenRowMapper();

  constructor(private db: Database) {}

  private getDb(tx?: DomainTransaction): Database | DrizzleTransaction {
    return (tx as unknown as DrizzleTransaction) ?? this.db;
  }

  private async hydrateSubscription(
    row: SubscriptionRow,
  ): Promise<DomainSubscription> {
    const subscribeTokenRow = await this.findTokenBySubscriptionIdAndScope(
      row.id,
      'subscribe',
    );
    const unsubscribeTokenRow = await this.findTokenBySubscriptionIdAndScope(
      row.id,
      'unsubscribe',
    );

    const subscribeToken = subscribeTokenRow
      ? this.tokenMapper.toDomain(subscribeTokenRow)
      : null;

    const unsubscribeToken = unsubscribeTokenRow
      ? this.tokenMapper.toDomain(unsubscribeTokenRow)
      : null;

    if (subscribeToken) {
      return this.subscriptionMapper.toDomain(
        row,
        subscribeToken,
        unsubscribeToken,
      );
    } else {
      throw new Error('Subscribe token not found');
    }
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

    return SubscriptionRowSchema.parse(result);
  }

  async findByEmailAndRepo(
    email: Email,
    repoPath: RepoPath,
  ): Promise<DomainSubscription | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.email, email.email),
          eq(subscriptions.repo, repoPath.toString()),
        ),
      )
      .limit(1);

    return result
      ? this.hydrateSubscription(SubscriptionRowSchema.parse(result))
      : null;
  }

  async findSubscriptionById(id: number): Promise<Subscription | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    return result ? SubscriptionRowSchema.parse(result) : null;
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

    return results.map((r) => SubscriptionRowSchema.parse(r));
  }

  async findAllConfirmedSubscriptions(): Promise<Subscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.confirmed, true));

    return results.map((r) => SubscriptionRowSchema.parse(r));
  }

  async findSubscriptionsByEmail(email: string): Promise<Subscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.email, email));

    return results.map((r) => SubscriptionRowSchema.parse(r));
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

    return SubscriptionTokenRowSchema.parse(result);
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

    return SubscriptionTokenRowSchema.parse(result);
  }

  async findTokenByValue(token: string): Promise<SubscriptionToken | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptionTokens)
      .where(eq(subscriptionTokens.token, token))
      .limit(1);

    if (!result) return null;

    return SubscriptionTokenRowSchema.parse(result);
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

    return SubscriptionTokenRowSchema.parse(result);
  }

  async deleteToken(token: string, tx?: DomainTransaction): Promise<void> {
    await this.getDb(tx)
      .delete(subscriptionTokens)
      .where(eq(subscriptionTokens.token, token));
  }
}
