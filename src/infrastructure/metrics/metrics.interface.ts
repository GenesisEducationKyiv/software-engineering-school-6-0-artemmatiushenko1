export interface Metrics {
  incrementNotificationsSent(): void;
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
