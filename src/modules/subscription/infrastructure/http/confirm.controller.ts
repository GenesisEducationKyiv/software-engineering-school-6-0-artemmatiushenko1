import type { FastifyInstance } from 'fastify';
import type { ConfirmUseCase } from '../../application/confirm.use-case.js';
import { CommonSuccessResponseDtoSchema } from '../../../../platform/http/response.dto.js';

export function registerConfirmRoute(
  fastify: FastifyInstance,
  confirmUseCase: ConfirmUseCase,
): void {
  fastify.get<{ Params: { token?: string } }>(
    '/confirm/:token',
    async (request, reply) => {
      const { token = '' } = request.params;
      await confirmUseCase.execute(token);

      return reply.status(200).send(
        CommonSuccessResponseDtoSchema.parse({
          message: 'Subscription confirmed successfully',
        }),
      );
    },
  );
}
