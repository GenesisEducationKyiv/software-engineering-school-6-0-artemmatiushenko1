import type { FastifyInstance } from 'fastify';
import type { SubscriptionService } from '../../api/subscription-service.interface.js';
import { CommonSuccessResponseDtoSchema } from '../../../../dtos/response.dto.js';

export function registerConfirmRoute(
  fastify: FastifyInstance,
  subscriptionService: SubscriptionService,
): void {
  fastify.get<{ Params: { token?: string } }>(
    '/confirm/:token',
    async (request, reply) => {
      const { token = '' } = request.params;
      await subscriptionService.confirm(token);

      return reply.status(200).send(
        CommonSuccessResponseDtoSchema.parse({
          message: 'Subscription confirmed successfully',
        }),
      );
    },
  );
}
