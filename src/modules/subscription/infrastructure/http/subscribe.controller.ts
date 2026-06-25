import type { FastifyInstance } from 'fastify';
import type { SubscribeUseCase } from '../../application/subscribe.use-case.js';
import { CommonSuccessResponseDtoSchema } from '../../../../dtos/response.dto.js';

export function registerSubscribeRoute(
  fastify: FastifyInstance,
  subscribeUseCase: SubscribeUseCase,
): void {
  fastify.post<{ Body: { email?: string; repo?: string } }>(
    '/subscribe',
    async (request, reply) => {
      const { email = '', repo = '' } = request.body;
      await subscribeUseCase.execute(email, repo);

      return reply.status(200).send(
        CommonSuccessResponseDtoSchema.parse({
          message: 'Subscription successful. Confirmation email sent.',
        }),
      );
    },
  );
}
