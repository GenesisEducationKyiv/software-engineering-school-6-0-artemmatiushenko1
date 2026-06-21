import type { FastifyPluginCallback } from 'fastify';

export const healthRoutes: FastifyPluginCallback = (fastify, _opts) => {
  fastify.get('/health', () => {
    return { status: 'ok' };
  });
};
