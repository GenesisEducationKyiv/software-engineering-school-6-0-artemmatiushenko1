import type { MonitoredRepo, RepoPath } from '../../domain/index.js';
import type { DomainTransaction } from '../../../../shared-kernel/transaction.js';

export interface MonitoredRepoRepository {
  findAll(): Promise<MonitoredRepo[]>;

  findByRepo(
    repo: RepoPath,
    tx?: DomainTransaction,
  ): Promise<MonitoredRepo | null>;

  save(monitoredRepo: MonitoredRepo, tx: DomainTransaction): Promise<void>;
}
