export interface DomainTransaction {
  readonly _brand: unique symbol;
}

export interface TransactionManager {
  run<T>(work: (tx: DomainTransaction) => Promise<T>): Promise<T>;
}
