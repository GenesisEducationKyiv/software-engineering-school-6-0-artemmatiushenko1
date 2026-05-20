import {
  Counter,
  Histogram,
  register,
  collectDefaultMetrics,
} from 'prom-client';
import type { Metrics } from '../../domain/metrics.js';

export class PrometheusMetrics implements Metrics {
  constructor() {
    collectDefaultMetrics();
  }

  private subscriptionRequests = new Counter({
    name: 'subscription_requests_total',
    help: 'Total number of subscription requests',
    labelNames: ['repo'],
  });

  private subscriptionConfirmations = new Counter({
    name: 'subscription_confirmations_total',
    help: 'Total number of confirmed subscriptions',
    labelNames: ['repo'],
  });

  private unsubscribeRequests = new Counter({
    name: 'unsubscribe_requests_total',
    help: 'Total number of unsubscribe requests',
    labelNames: ['repo'],
  });

  private notificationsSent = new Counter({
    name: 'notifications_sent_total',
    help: 'Total number of notifications sent',
    labelNames: ['repo'],
  });

  private scanTotal = new Counter({
    name: 'scanner_runs_total',
    help: 'Total number of scanner runs',
  });

  private scanFailures = new Counter({
    name: 'scanner_failures_total',
    help: 'Total number of scanner failures',
  });

  private scanDuration = new Histogram({
    name: 'scanner_run_duration_seconds',
    help: 'Duration of scanner runs in seconds',
    buckets: [1, 5, 10, 30, 60, 120, 300],
  });

  private cacheHits = new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['type'],
  });

  private cacheMisses = new Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['type'],
  });

  incrementSubscriptionRequests(repo: string): void {
    this.subscriptionRequests.inc({ repo });
  }

  incrementSubscriptionConfirmations(repo: string): void {
    this.subscriptionConfirmations.inc({ repo });
  }

  incrementUnsubscribeRequests(repo: string): void {
    this.unsubscribeRequests.inc({ repo });
  }

  incrementNotificationsSent(repo: string): void {
    this.notificationsSent.inc({ repo });
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

  incrementCacheHit(type: string): void {
    this.cacheHits.inc({ type });
  }

  incrementCacheMiss(type: string): void {
    this.cacheMisses.inc({ type });
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}
