import type { MonitoredRepo } from '../../domain/index.js';
import type { DomainTransaction } from '../../../../shared-kernel/transaction.js';

export interface MonitoredRepoRepository {
  findAll(): Promise<MonitoredRepo[]>;

  save(monitoredRepo: MonitoredRepo, tx: DomainTransaction): Promise<void>;
}
