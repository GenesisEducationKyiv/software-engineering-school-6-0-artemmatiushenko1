export interface MetricsExporter {
  getMetrics(): Promise<string>;
  getContentType(): string;
}
