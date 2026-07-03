import type { IntegrationEvent } from '../event-bus/domain-event-envelope.js';
import type { DomainTransaction } from '../../shared-kernel/transaction.js';

export interface Outbox {
  save(events: IntegrationEvent[], tx: DomainTransaction): Promise<void>;
}
