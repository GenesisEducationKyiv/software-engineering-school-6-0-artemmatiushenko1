export type ClaimHandle = {
  release(): Promise<void>;
};

export interface IdempotencyGuard {
  claim(key: string): Promise<ClaimHandle | null>;
}
