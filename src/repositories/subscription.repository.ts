import type {
  Database,
  Transaction as DrizzleTransaction,
} from '../db/types.js';
import { subscriptions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  Subscription,
  Email,
  RepoPath,
  ConfirmationTokenScope,
  SubscriptionStatus,
} from '../domain/subscription/index.js';
import {
  SubscriptionRowMapper,
  SubscriptionRowSchema,
} from './subscription-row.mapper.js';
import type { SubscriptionRepository } from '../domain/subscription.repository.js';
import type { DomainTransaction } from '../domain/shared/index.js';

export class DrizzleSubscriptionRepository implements SubscriptionRepository {
  private readonly subscriptionMapper = new SubscriptionRowMapper();

  constructor(private db: Database) {}

  private getDb(tx?: DomainTransaction): Database | DrizzleTransaction {
    return (tx as unknown as DrizzleTransaction) ?? this.db;
  }

  private toDomain(row: unknown): Subscription {
    return this.subscriptionMapper.toDomain(SubscriptionRowSchema.parse(row));
  }

  async findByToken(
    token: string,
    scope: ConfirmationTokenScope,
  ): Promise<Subscription | null> {
    const tokenColumn =
      scope === ConfirmationTokenScope.Subscribe
        ? subscriptions.confirmToken
        : subscriptions.unsubscribeToken;

    const [result] = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(tokenColumn, token))
      .limit(1);

    return result ? this.toDomain(result) : null;
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

    return result ? this.toDomain(result) : null;
  }

  async save(
    subscription: Subscription,
    tx?: DomainTransaction,
  ): Promise<void> {
    const rowValues = this.subscriptionMapper.toRow(subscription);
    const { id: _id, ...updateValues } = rowValues;

    await this.getDb(tx)
      .insert(subscriptions)
      .values(rowValues)
      .onConflictDoUpdate({
        target: subscriptions.id,
        set: updateValues,
      });
  }

  async findById(id: string): Promise<Subscription | null> {
    const [result] = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);

    return result ? this.toDomain(result) : null;
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
          eq(subscriptions.status, SubscriptionStatus.Confirmed),
        ),
      );

    return results.map((row) => this.toDomain(row));
  }

  async findAllConfirmedSubscriptions(): Promise<Subscription[]> {
    const results = await this.getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.status, 'confirmed'));

    return results.map((row) => this.toDomain(row));
  }
}
