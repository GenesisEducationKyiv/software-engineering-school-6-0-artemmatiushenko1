import type {
  Database,
  Transaction as DrizzleTransaction,
} from '../db/types.js';
import { subscriptions, subscriptionTokens } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type {
  SubscriptionToken,
  SubscriptionTokenScope,
} from '../domain/subscription.js';
import { Subscription as DomainSubscription } from '../domain/subscription/subscription.js';
import { Email } from '../domain/subscription/email.js';
import { RepoPath } from '../domain/subscription/repo-path.js';
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

  async save(
    subscription: DomainSubscription,
    tx?: DomainTransaction,
  ): Promise<void> {
    await this.upsertSubscriptionRow(subscription, tx);
    await this.replaceTokens(subscription, tx);
  }

  private async upsertSubscriptionRow(
    subscription: DomainSubscription,
    tx?: DomainTransaction,
  ): Promise<void> {
    const rowValues = {
      id: subscription.id,
      email: subscription.email.email,
      repo: subscription.repoPath.toString(),
      confirmed: subscription.status === 'confirmed',
      lastSeenTag: subscription.lastSeenTag?.value ?? null,
    };

    await this.getDb(tx)
      .insert(subscriptions)
      .values(rowValues)
      .onConflictDoUpdate({
        target: subscriptions.id,
        set: {
          email: rowValues.email,
          repo: rowValues.repo,
          confirmed: rowValues.confirmed,
          lastSeenTag: rowValues.lastSeenTag,
        },
      });
  }

  private async replaceTokens(
    subscription: DomainSubscription,
    tx?: DomainTransaction,
  ): Promise<void> {
    await this.getDb(tx)
      .delete(subscriptionTokens)
      .where(eq(subscriptionTokens.subscriptionId, subscription.id));

    const confirmation = subscription.confirmationToken;
    const unsubscribe = subscription.unsubscribeToken;

    await this.createToken(
      {
        subscriptionId: subscription.id,
        token: confirmation.value,
        scope: confirmation.scope,
        expiresAt: confirmation.expiresAt,
      },
      tx,
    );

    if (unsubscribe) {
      await this.createToken(
        {
          subscriptionId: subscription.id,
          token: unsubscribe.value,
          scope: unsubscribe.scope,
          expiresAt: unsubscribe.expiresAt,
        },
        tx,
      );
    }
  }

  async findSubscriptionById(id: string): Promise<SubscriptionRow | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    return result ? SubscriptionRowSchema.parse(result) : null;
  }

  async findConfirmedSubscriptionsByEmail(
    email: string,
  ): Promise<SubscriptionRow[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(
        and(eq(subscriptions.email, email), eq(subscriptions.confirmed, true)),
      );

    return results.map((r) => SubscriptionRowSchema.parse(r));
  }

  async findAllConfirmedSubscriptions(): Promise<DomainSubscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.confirmed, true));

    return Promise.all(
      results.map((row) =>
        this.hydrateSubscription(SubscriptionRowSchema.parse(row)),
      ),
    );
  }

  async findSubscriptionsByEmail(email: string): Promise<SubscriptionRow[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.email, email));

    return results.map((r) => SubscriptionRowSchema.parse(r));
  }

  async confirmSubscription(id: string, tx?: DomainTransaction): Promise<void> {
    await this.getDb(tx)
      .update(subscriptions)
      .set({ confirmed: true })
      .where(eq(subscriptions.id, id));
  }

  async updateLastSeenTag(
    id: string,
    tag: string,
    tx?: DomainTransaction,
  ): Promise<void> {
    await this.getDb(tx)
      .update(subscriptions)
      .set({ lastSeenTag: tag })
      .where(eq(subscriptions.id, id));
  }

  async deleteSubscription(id: string, tx?: DomainTransaction): Promise<void> {
    await this.getDb(tx).delete(subscriptions).where(eq(subscriptions.id, id));
  }

  async createToken(
    data: {
      subscriptionId: string;
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
    subscriptionId: string,
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
