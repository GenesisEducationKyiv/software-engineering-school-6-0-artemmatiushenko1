import type { DomainEventEnvelope } from '../event-bus/domain-event-envelope.js';
import type { DomainTransaction } from '../../shared-kernel/transaction.js';
import type { OutboxMessage } from './outbox-message.js';

export interface OutboxRepository {
  save(events: DomainEventEnvelope[], tx: DomainTransaction): Promise<void>;
  fetchPending(limit: number, tx?: DomainTransaction): Promise<OutboxMessage[]>;
  markProcessed(ids: string[], tx?: DomainTransaction): Promise<void>;
}
