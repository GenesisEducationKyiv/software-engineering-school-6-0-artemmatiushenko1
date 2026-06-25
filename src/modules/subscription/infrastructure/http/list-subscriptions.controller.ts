import type { FastifyInstance } from 'fastify';
import type { GetSubscriptionsByEmailUseCase } from '../../application/get-subscriptions-by-email.use-case.js';
import { SubscriptionsResponseDtoSchema } from './subscriptions-response.dto.js';
import { SubscriptionStatus } from '../../domain/index.js';

export function registerListSubscriptionsRoute(
  fastify: FastifyInstance,
  getSubscriptionsByEmailUseCase: GetSubscriptionsByEmailUseCase,
): void {
  fastify.get<{ Querystring: { email?: string } }>(
    '/subscriptions',
    async (request, reply) => {
      const { email = '' } = request.query;
      const subscriptions = await getSubscriptionsByEmailUseCase.execute(email);

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
