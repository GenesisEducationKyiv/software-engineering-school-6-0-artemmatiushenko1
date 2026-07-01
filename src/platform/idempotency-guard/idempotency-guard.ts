export type ClaimHandle = {
  release(): Promise<void>;
};

export interface IdempotencyGuard {
  claim(id?: string): Promise<ClaimHandle | null>;
}
