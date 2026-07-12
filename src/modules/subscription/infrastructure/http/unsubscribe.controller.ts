import type { FastifyInstance } from 'fastify';
import type { UnsubscribeUseCase } from '../../application/use-cases/unsubscribe.use-case.js';
import { CommonSuccessResponseDtoSchema } from '../../../../platform/http/response.dto.js';

export function registerUnsubscribeRoute(
  fastify: FastifyInstance,
  unsubscribeUseCase: UnsubscribeUseCase,
): void {
  fastify.get<{ Params: { token?: string } }>(
    '/unsubscribe/:token',
    async (request, reply) => {
      const { token = '' } = request.params;
      await unsubscribeUseCase.execute(token);

      return reply.status(200).send(
        CommonSuccessResponseDtoSchema.parse({
          message: 'Unsubscribed successfully',
        }),
      );
    },
  );
}
