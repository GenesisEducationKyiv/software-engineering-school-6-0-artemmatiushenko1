import { Counter, Histogram } from 'prom-client';
import type { ScannerMetrics } from '../application/ports/scanner-metrics.interface.js';

export class PrometheusScannerMetrics implements ScannerMetrics {
  private readonly scanTotal = new Counter({
    name: 'scanner_runs_total',
    help: 'Total number of scanner runs',
  });

  private readonly scanFailures = new Counter({
    name: 'scanner_failures_total',
    help: 'Total number of scanner failures',
  });

  private readonly scanDuration = new Histogram({
    name: 'scanner_run_duration_seconds',
    help: 'Duration of scanner runs in seconds',
    buckets: [1, 5, 10, 30, 60, 120, 300],
  });

  incrementScanTotal(): void {
    this.scanTotal.inc();
  }

  incrementScanFailures(): void {
    this.scanFailures.inc();
  }

  recordScanDuration(durationSeconds: number): void {
    this.scanDuration.observe(durationSeconds);
  }
}
