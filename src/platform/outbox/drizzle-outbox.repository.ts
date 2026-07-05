import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  Database,
  Transaction as DrizzleTransaction,
} from '../db/types.js';
import { outboxMessages } from '../db/schema.js';
import type { IntegrationEvent } from '../event-bus/domain-event-envelope.js';
import type { DomainTransaction } from '../../shared-kernel/transaction.js';
import type { IdGenerator } from '../../shared-kernel/id-generator.js';
import type { OutboxMessage } from './outbox-message.js';
import type { OutboxRepository } from './outbox.repository.js';

export class DrizzleOutboxRepository implements OutboxRepository {
  constructor(
    private readonly db: Database,
    private readonly idGenerator: IdGenerator,
  ) {}

  private getDb(tx?: DomainTransaction): Database | DrizzleTransaction {
    return (tx as unknown as DrizzleTransaction) ?? this.db;
  }

  private toOutboxMessage(
    row: typeof outboxMessages.$inferSelect,
  ): OutboxMessage {
    return {
      id: row.id,
      eventType: row.eventType,
      aggregateId: row.aggregateId,
      occurredAt: row.occurredAt,
      payload: row.payload,
      createdAt: row.createdAt,
      processedAt: row.processedAt,
      attemptCount: row.attemptCount,
      lastError: row.lastError,
      deadLetteredAt: row.deadLetteredAt,
    };
  }

  async save(events: IntegrationEvent[], tx: DomainTransaction): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.getDb(tx)
      .insert(outboxMessages)
      .values(
        events.map((event) => ({
          id: this.idGenerator.next(),
          eventType: event.type,
          aggregateId: event.aggregateId,
          occurredAt: new Date(event.occurredAt),
          payload: event.payload,
        })),
      );
  }

  async fetchPending(
    limit: number,
    tx?: DomainTransaction,
  ): Promise<OutboxMessage[]> {
    const rows = await this.getDb(tx)
      .select()
      .from(outboxMessages)
      .where(
        and(
          isNull(outboxMessages.processedAt),
          isNull(outboxMessages.deadLetteredAt),
        ),
      )
      .orderBy(asc(outboxMessages.createdAt))
      .limit(limit)
      .for('update', { skipLocked: true });

    return rows.map((row) => this.toOutboxMessage(row));
  }

  async markProcessed(ids: string[], tx?: DomainTransaction): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    await this.getDb(tx)
      .update(outboxMessages)
      .set({ processedAt: new Date() })
      .where(inArray(outboxMessages.id, ids));
  }

  async recordFailure(id: string, error: string): Promise<number> {
    const [row] = await this.db
      .update(outboxMessages)
      .set({
        attemptCount: sql`${outboxMessages.attemptCount} + 1`,
        lastError: error,
      })
      .where(eq(outboxMessages.id, id))
      .returning({ attemptCount: outboxMessages.attemptCount });

    if (!row) {
      throw new Error(`Outbox message not found: ${id}`);
    }

    return row.attemptCount;
  }

  async moveToDeadLetter(id: string, error: string): Promise<void> {
    await this.db
      .update(outboxMessages)
      .set({
        deadLetteredAt: new Date(),
        lastError: error,
      })
      .where(eq(outboxMessages.id, id));
  }

  async countPending(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxMessages)
      .where(
        and(
          isNull(outboxMessages.processedAt),
          isNull(outboxMessages.deadLetteredAt),
        ),
      );

    return row?.count ?? 0;
  }

  async countDeadLetters(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboxMessages)
      .where(sql`${outboxMessages.deadLetteredAt} is not null`);

    return row?.count ?? 0;
  }

  async oldestPendingAgeSeconds(): Promise<number> {
    const [row] = await this.db
      .select({
        ageSeconds: sql<number>`coalesce(extract(epoch from (now() - min(${outboxMessages.createdAt}))), 0)::int`,
      })
      .from(outboxMessages)
      .where(
        and(
          isNull(outboxMessages.processedAt),
          isNull(outboxMessages.deadLetteredAt),
        ),
      );

    return row?.ageSeconds ?? 0;
  }
}
