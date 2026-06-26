export interface ScannerMetrics {
  incrementScanTotal(): void;
  incrementScanFailures(): void;
  recordScanDuration(durationSeconds: number): void;
}
