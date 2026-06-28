import type { Recipient } from '../../domain/recipient.js';
import type { DomainTransaction } from '../../../../shared-kernel/transaction.js';

export interface RecipientRepository {
  findBySubscriptionId(
    subscriptionId: string,
    tx?: DomainTransaction,
  ): Promise<Recipient | null>;

  save(recipient: Recipient, tx?: DomainTransaction): Promise<void>;

  delete(subscriptionId: string, tx?: DomainTransaction): Promise<void>;
}
