import type { FastifyInstance } from 'fastify';
import type { SubscriptionService } from '../../api/subscription-service.interface.js';
import { SubscriptionsResponseDtoSchema } from '../../../../dtos/subscription.dto.js';
import { SubscriptionStatus } from '../../domain/index.js';

export function registerListSubscriptionsRoute(
  fastify: FastifyInstance,
  subscriptionService: SubscriptionService,
): void {
  fastify.get<{ Querystring: { email?: string } }>(
    '/subscriptions',
    async (request, reply) => {
      const { email = '' } = request.query;
      const subscriptions =
        await subscriptionService.getSubscriptionsByEmail(email);

      return reply.status(200).send(
        SubscriptionsResponseDtoSchema.parse(
          subscriptions.map((subscription) => ({
            email: subscription.email.value,
            repo: subscription.repoPath.toString(),
            confirmed: subscription.status === SubscriptionStatus.Confirmed,
            lastSeenTag: subscription.lastSeenTag?.value ?? null,
          })),
        ),
      );
    },
  );
}
