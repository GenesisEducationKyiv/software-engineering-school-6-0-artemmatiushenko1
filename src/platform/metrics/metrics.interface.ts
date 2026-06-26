import type { NotificationMetrics } from '../../modules/notification/application/ports/notification-metrics.js';
import type { ScannerMetrics } from '../../modules/scanner/scanner-metrics.interface.js';
import type { CacheMetrics } from '../../modules/github/api/cache-metrics.interface.js';
import type { HttpMetrics } from './http-metrics.interface.js';
import type { MetricsExporter } from './metrics-exporter.interface.js';

export type Metrics = NotificationMetrics &
  ScannerMetrics &
  CacheMetrics &
  HttpMetrics &
  MetricsExporter;
