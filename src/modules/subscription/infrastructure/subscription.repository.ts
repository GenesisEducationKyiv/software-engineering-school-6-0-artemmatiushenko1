import type {
  Database,
  Transaction as DrizzleTransaction,
} from '../../../db/types.js';
import { subscriptions, subscriptionTokens } from '../../../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { Subscription } from '../domain/subscription.js';
import { Email } from '../domain/email.js';
import { RepoPath } from '../domain/repo-path.js';
import {
  SubscriptionRowMapper,
  SubscriptionRowSchema,
  type SubscriptionRow,
} from './subscription-row.mapper.js';
import {
  SubscriptionTokenRowMapper,
  SubscriptionTokenRowSchema,
  type SubscriptionTokenRow,
} from './subscription-token-row.mapper.js';
import type { SubscriptionRepository } from '../application/ports/subscription.repository.js';
import type { DomainTransaction } from '../../../domain/shared/index.js';
import type { ConfirmationTokenScope } from '../domain/confirmation-token.js';

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  private readonly subscriptionMapper = new SubscriptionRowMapper();
  private readonly tokenMapper = new SubscriptionTokenRowMapper();

  constructor(private db: Database) {}

  private getDb(tx?: DomainTransaction): Database | DrizzleTransaction {
    return (tx as unknown as DrizzleTransaction) ?? this.db;
  }

  private async hydrateSubscription(
    row: SubscriptionRow,
  ): Promise<Subscription> {
    const subscribeTokenRow = await this.findTokenByIdAndScope(
      row.id,
      'subscribe',
    );
    const unsubscribeTokenRow = await this.findTokenByIdAndScope(
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

  async findByToken(
    token: string,
    scope: ConfirmationTokenScope,
  ): Promise<Subscription | null> {
    const tokenRow = await this.findToken(token, scope);
    if (!tokenRow) {
      return null;
    }

    return await this.findById(tokenRow.subscriptionId);
  }

  async findByEmailAndRepo(
    email: Email,
    repoPath: RepoPath,
  ): Promise<Subscription | null> {
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
    subscription: Subscription,
    tx?: DomainTransaction,
  ): Promise<void> {
    await this.upsertSubscriptionRow(subscription, tx);
    await this.replaceTokens(subscription, tx);
  }

  private async upsertSubscriptionRow(
    subscription: Subscription,
    tx?: DomainTransaction,
  ): Promise<void> {
    const rowValues = {
      id: subscription.id,
      email: subscription.email.email,
      repo: subscription.repoPath.toString(),
      status: subscription.status,
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
          status: rowValues.status,
          lastSeenTag: rowValues.lastSeenTag,
        },
      });
  }

  private async replaceTokens(
    subscription: Subscription,
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
        usedAt: confirmation.consumedAt,
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
          usedAt: unsubscribe.consumedAt,
        },
        tx,
      );
    }
  }

  async findById(id: string): Promise<Subscription | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    return result
      ? this.hydrateSubscription(SubscriptionRowSchema.parse(result))
      : null;
  }

  async findConfirmedSubscriptionsByEmail(
    email: Email,
  ): Promise<Subscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.email, email.email),
          eq(subscriptions.status, 'confirmed'),
        ),
      );

    return Promise.all(
      results.map((row) =>
        this.hydrateSubscription(SubscriptionRowSchema.parse(row)),
      ),
    );
  }

  async findAllConfirmedSubscriptions(): Promise<Subscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.status, 'confirmed'));

    return Promise.all(
      results.map((row) =>
        this.hydrateSubscription(SubscriptionRowSchema.parse(row)),
      ),
    );
  }

  private async createToken(
    data: {
      subscriptionId: string;
      token: string;
      scope: ConfirmationTokenScope;
      expiresAt: Date;
      usedAt: Date | null;
    },
    tx?: DomainTransaction,
  ): Promise<SubscriptionTokenRow> {
    const [result] = await this.getDb(tx)
      .insert(subscriptionTokens)
      .values({
        subscriptionId: data.subscriptionId,
        token: data.token,
        scope: data.scope,
        expiresAt: data.expiresAt,
        usedAt: data.usedAt,
      })
      .returning();

    return SubscriptionTokenRowSchema.parse(result);
  }

  private async findToken(
    token: string,
    scope: ConfirmationTokenScope,
  ): Promise<SubscriptionTokenRow | null> {
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

  private async findTokenByIdAndScope(
    subscriptionId: string,
    scope: ConfirmationTokenScope,
  ): Promise<SubscriptionTokenRow | null> {
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
}
