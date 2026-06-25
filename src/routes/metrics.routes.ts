import type { FastifyPluginCallback } from 'fastify';
import type { Metrics } from '../infrastructure/metrics/metrics.interface.js';

interface MetricsRoutesOptions {
  metrics: Metrics;
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
