import { register } from 'prom-client';
import type { MetricsExporter } from './metrics-exporter.interface.js';

export class PrometheusExporter implements MetricsExporter {
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}
