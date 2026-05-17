import type { FastifyPluginCallback } from 'fastify';
import { PrometheusMetrics } from '../infrastructure/metrics/prometheus-metrics.js';

interface MetricsRoutesOptions {
  metrics: PrometheusMetrics;
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
