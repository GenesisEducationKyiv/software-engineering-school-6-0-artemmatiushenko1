import type { FastifyInstance } from 'fastify';
import type { MetricsExporter } from './metrics-exporter.interface.js';

export function registerMetricsRoute(
  fastify: FastifyInstance,
  metrics: MetricsExporter,
): void {
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', metrics.getContentType());
    return metrics.getMetrics();
  });
}
