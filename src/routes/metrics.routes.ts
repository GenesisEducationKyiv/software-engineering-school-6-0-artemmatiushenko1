import type { FastifyPluginCallback } from 'fastify';
import type { MetricsExporter } from '../infrastructure/metrics/metrics-exporter.interface.js';

interface MetricsRoutesOptions {
  metrics: MetricsExporter;
}

export const metricsRoutes: FastifyPluginCallback<MetricsRoutesOptions> = (
  fastify,
  opts,
) => {
  const { metrics } = opts;

  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', metrics.getContentType());
    return metrics.getMetrics();
  });
};
