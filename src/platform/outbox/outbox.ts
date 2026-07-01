import type { DomainEventEnvelope } from '../event-bus/domain-event-envelope.js';
import type { DomainTransaction } from '../../shared-kernel/transaction.js';

export interface Outbox {
  save(events: DomainEventEnvelope[], tx: DomainTransaction): Promise<void>;
}
