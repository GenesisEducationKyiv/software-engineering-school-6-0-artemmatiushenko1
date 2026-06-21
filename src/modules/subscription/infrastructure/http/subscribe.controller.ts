import type { FastifyInstance } from 'fastify';
import type { SubscriptionService } from '../../api/subscription-service.interface.js';
import { CommonSuccessResponseDtoSchema } from '../../../../dtos/response.dto.js';

export function registerSubscribeRoute(
  fastify: FastifyInstance,
  subscriptionService: SubscriptionService,
): void {
  fastify.post<{ Body: { email?: string; repo?: string } }>(
    '/subscribe',
    async (request, reply) => {
      const { email = '', repo = '' } = request.body;
      await subscriptionService.subscribe(email, repo);

      return reply.status(200).send(
        CommonSuccessResponseDtoSchema.parse({
          message: 'Subscription successful. Confirmation email sent.',
        }),
      );
    },
  );
}
