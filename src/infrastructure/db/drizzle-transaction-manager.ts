import type { Database } from '../../db/types.js';
import type {
  DomainTransaction,
  TransactionManager,
} from '../../shared-kernel/transaction.js';

export class DrizzleTransactionManager implements TransactionManager {
  constructor(private db: Database) {}

  async run<T>(work: (tx: DomainTransaction) => Promise<T>): Promise<T> {
    return await this.db.transaction(async (drizzleTx) => {
      return await work(drizzleTx as unknown as DomainTransaction);
    });
  }
}
