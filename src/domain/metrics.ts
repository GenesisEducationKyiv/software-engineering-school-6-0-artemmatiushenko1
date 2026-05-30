export interface Metrics {
  incrementSubscriptionRequests(repo: string): void;
  incrementSubscriptionConfirmations(repo: string): void;
  incrementUnsubscribeRequests(repo: string): void;
  incrementNotificationsSent(repo: string): void;
  incrementScanTotal(): void;
  incrementScanFailures(): void;
  recordScanDuration(durationSeconds: number): void;
  incrementCacheHit(type: string): void;
  incrementCacheMiss(type: string): void;
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void;
  getMetrics(): Promise<string>;
  getContentType(): string;
}
