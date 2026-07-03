export interface IdempotencyGuard {
  isProcessed(key: string): Promise<boolean>;
  markProcessed(key: string): Promise<void>;
}
