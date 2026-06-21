import type { FastifyInstance } from 'fastify';
import type { SubscriptionService } from '../../api/subscription-service.interface.js';
import { CommonSuccessResponseDtoSchema } from '../../../../dtos/response.dto.js';

export function registerUnsubscribeRoute(
  fastify: FastifyInstance,
  subscriptionService: SubscriptionService,
): void {
  fastify.get<{ Params: { token?: string } }>(
    '/unsubscribe/:token',
    async (request, reply) => {
      const { token = '' } = request.params;
      await subscriptionService.unsubscribe(token);

      return reply.status(200).send(
        CommonSuccessResponseDtoSchema.parse({
          message: 'Unsubscribed successfully',
        }),
      );
    },
  );
}
