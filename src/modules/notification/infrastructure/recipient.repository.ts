import { eq } from 'drizzle-orm';
import { notificationRecipients } from '../../../platform/db/schema.js';
import type {
  Database,
  Transaction as DrizzleTransaction,
} from '../../../platform/db/types.js';
import type { DomainTransaction } from '../../../shared-kernel/transaction.js';
import type { RecipientRepository } from '../application/ports/recipient.repository.js';
import type { Recipient } from '../domain/recipient.js';
import {
  RecipientRowMapper,
  RecipientRowSchema,
} from './recipient-row.mapper.js';

export class DrizzleRecipientRepository implements RecipientRepository {
  private readonly mapper = new RecipientRowMapper();

  constructor(private readonly db: Database) {}

  private getDb(tx?: DomainTransaction): Database | DrizzleTransaction {
    return tx ? (tx as unknown as DrizzleTransaction) : this.db;
  }

  async findBySubscriptionId(
    subscriptionId: string,
    tx?: DomainTransaction,
  ): Promise<Recipient | null> {
    const db = this.getDb(tx);
    const [row] = await db
      .select()
      .from(notificationRecipients)
      .where(eq(notificationRecipients.subscriptionId, subscriptionId))
      .limit(1);

    if (!row) {
      return null;
    }

    return this.mapper.toDomain(RecipientRowSchema.parse(row));
  }

  async save(recipient: Recipient, tx?: DomainTransaction): Promise<void> {
    const db = this.getDb(tx);
    const row = this.mapper.toRow(recipient);

    await db
      .insert(notificationRecipients)
      .values(row)
      .onConflictDoUpdate({
        target: notificationRecipients.subscriptionId,
        set: {
          email: row.email,
          unsubscribeToken: row.unsubscribeToken,
        },
      });
  }

  async delete(subscriptionId: string, tx?: DomainTransaction): Promise<void> {
    const db = this.getDb(tx);
    await db
      .delete(notificationRecipients)
      .where(eq(notificationRecipients.subscriptionId, subscriptionId));
  }
}
