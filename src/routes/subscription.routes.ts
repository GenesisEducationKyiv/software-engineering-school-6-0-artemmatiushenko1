import type { FastifyPluginCallback } from 'fastify';
import type { SubscriptionService } from '../domain/subscription.js';
import { SubscriptionsResponseDtoSchema } from '../dtos/subscription.dto.js';
import { CommonSuccessResponseDtoSchema } from '../dtos/response.dto.js';

interface SubscriptionRoutesOptions {
  subscriptionService: SubscriptionService;
}

export const subscriptionRoutes: FastifyPluginCallback<
  SubscriptionRoutesOptions
> = (fastify, opts) => {
  const { subscriptionService } = opts;

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

  fastify.get<{ Querystring: { email?: string } }>(
    '/subscriptions',
    async (request, reply) => {
      const { email = '' } = request.query;
      const subscriptions =
        await subscriptionService.getSubscriptionsByEmail(email);

      return reply.status(200).send(
        SubscriptionsResponseDtoSchema.parse(
          subscriptions.map((subscription) => ({
            email: subscription.email.email,
            repo: subscription.repoPath.toString(),
            confirmed: subscription.status === 'confirmed',
            lastSeenTag: subscription.lastSeenTag?.value ?? null,
          })),
        ),
      );
    },
  );

  fastify.get<{ Params: { token?: string } }>(
    '/confirm/:token',
    async (request, reply) => {
      const { token = '' } = request.params;
      await subscriptionService.confirmSubscription(token);

      return reply.status(200).send(
        CommonSuccessResponseDtoSchema.parse({
          message: 'Subscription confirmed successfully',
        }),
      );
    },
  );

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
};
