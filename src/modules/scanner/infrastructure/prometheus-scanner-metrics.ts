import { Counter, Histogram, type Registry } from 'prom-client';
import type { ScannerMetrics } from '../application/ports/scanner-metrics.interface.js';

export class PrometheusScannerMetrics implements ScannerMetrics {
  private readonly scanTotal: Counter;
  private readonly scanFailures: Counter;
  private readonly scanDuration: Histogram;

  constructor(registry: Registry) {
    this.scanTotal = new Counter({
      name: 'scanner_runs_total',
      help: 'Total number of scanner runs',
      registers: [registry],
    });

    this.scanFailures = new Counter({
      name: 'scanner_failures_total',
      help: 'Total number of scanner failures',
      registers: [registry],
    });

    this.scanDuration = new Histogram({
      name: 'scanner_run_duration_seconds',
      help: 'Duration of scanner runs in seconds',
      buckets: [1, 5, 10, 30, 60, 120, 300],
      registers: [registry],
    });
  }

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
