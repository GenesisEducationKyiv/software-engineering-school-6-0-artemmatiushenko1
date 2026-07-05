import {
  Counter,
  Gauge,
  Histogram,
  register,
  collectDefaultMetrics,
} from 'prom-client';
import type { Metrics } from './metrics.interface.js';

export class PrometheusMetrics implements Metrics {
  constructor() {
    collectDefaultMetrics();
  }

  private notificationsSent = new Counter({
    name: 'notifications_sent_total',
    help: 'Total number of notifications sent',
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

  private httpRequests = new Counter({
    name: 'http_server_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  private httpRequestDuration = new Histogram({
    name: 'http_server_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  private outboxRelayFailures = new Counter({
    name: 'outbox_relay_failures_total',
    help: 'Total number of outbox relay delivery failures',
    labelNames: ['event_type'],
  });

  private outboxDeadLetters = new Counter({
    name: 'outbox_dead_letters_total',
    help: 'Total number of outbox messages moved to dead letter',
    labelNames: ['event_type'],
  });

  private outboxPendingMessages = new Gauge({
    name: 'outbox_pending_messages',
    help: 'Current number of pending outbox messages',
  });

  private outboxDeadLetterMessages = new Gauge({
    name: 'outbox_dead_letter_messages',
    help: 'Current number of dead-lettered outbox messages',
  });

  private outboxOldestPendingAgeSeconds = new Gauge({
    name: 'outbox_oldest_pending_age_seconds',
    help: 'Age in seconds of the oldest pending outbox message',
  });

  incrementNotificationsSent(): void {
    this.notificationsSent.inc();
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

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status_code: statusCode };
    this.httpRequests.inc(labels);
    this.httpRequestDuration.observe({ method, route }, durationSeconds);
  }

  incrementOutboxRelayFailures(eventType: string): void {
    this.outboxRelayFailures.inc({ event_type: eventType });
  }

  incrementOutboxDeadLetters(eventType: string): void {
    this.outboxDeadLetters.inc({ event_type: eventType });
  }

  setOutboxPendingMessages(count: number): void {
    this.outboxPendingMessages.set(count);
  }

  setOutboxDeadLetterMessages(count: number): void {
    this.outboxDeadLetterMessages.set(count);
  }

  setOutboxOldestPendingAgeSeconds(ageSeconds: number): void {
    this.outboxOldestPendingAgeSeconds.set(ageSeconds);
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}
