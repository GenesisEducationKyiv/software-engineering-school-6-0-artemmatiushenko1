import type { Registry } from 'prom-client';
import type { MetricsExporter } from './metrics-exporter.interface.js';

export class PrometheusExporter implements MetricsExporter {
  constructor(private readonly registry: Registry) {}

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
