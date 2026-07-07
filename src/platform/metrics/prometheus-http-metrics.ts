import { Counter, Histogram } from 'prom-client';
import type { HttpMetrics } from './http-metrics.interface.js';

export class PrometheusHttpMetrics implements HttpMetrics {
  private readonly httpRequests = new Counter({
    name: 'http_server_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  private readonly httpRequestDuration = new Histogram({
    name: 'http_server_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

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
}
