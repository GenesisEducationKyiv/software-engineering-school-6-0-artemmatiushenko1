import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(fastify: FastifyInstance): void {
  fastify.get('/health', () => {
    return { status: 'ok' };
  });
}
