import type { DomainTransaction } from '../../shared-kernel/transaction.js';
import type { Outbox } from './outbox.js';
import type { OutboxMessage } from './outbox-message.js';

export interface OutboxRepository extends Outbox {
  fetchPending(limit: number, tx?: DomainTransaction): Promise<OutboxMessage[]>;
  markProcessed(ids: string[], tx?: DomainTransaction): Promise<void>;
  recordFailure(id: string, error: string): Promise<number>;
  moveToDeadLetter(id: string, error: string): Promise<void>;
  countPending(): Promise<number>;
  countDeadLetters(): Promise<number>;
  oldestPendingAgeSeconds(): Promise<number>;
}
