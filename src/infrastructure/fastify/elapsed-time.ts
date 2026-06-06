import type { FastifyReply } from 'fastify';

export function elapsedTimeToSeconds(reply: FastifyReply): number {
  return reply.elapsedTime / 1000;
}
