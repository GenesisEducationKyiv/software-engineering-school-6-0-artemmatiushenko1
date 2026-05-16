import type { FastifyPluginCallback } from 'fastify';
import { SubscriptionService } from '../services/subscription.service.js';
import { SubscriptionsResponseDtoSchema } from '../dtos/subscription.dto.js';
import { CommonSuccessResponseDtoSchema } from '../dtos/response.dto.js';
import {
  TokenNotFoundError,
  InvalidTokenError,
} from '../domain/errors.js';

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

  fastify.get<{ Querystring: { email: string } }>(
    '/subscriptions',
    async (request, reply) => {
      const { email } = request.query;
      const subscriptions =
        await subscriptionService.getSubscriptionsByEmail(email);
      return reply
        .status(200)
        .send(SubscriptionsResponseDtoSchema.parse(subscriptions));
    },
  );

  fastify.get<{ Params: { token: string } }>(
    '/confirm/:token',
    async (request, reply) => {
      const { token } = request.params;
      try {
        await subscriptionService.confirmSubscription(token);
        return reply.status(200).send(
          CommonSuccessResponseDtoSchema.parse({
            message: 'Subscription confirmed successfully',
          }),
        );
      } catch (error) {
        if (
          error instanceof TokenNotFoundError ||
          error instanceof InvalidTokenError
        ) {
          return reply.status(400).send({
            code: 'INVALID_TOKEN',
            error: 'Invalid or expired confirmation link.',
          });
        }
        throw error;
      }
    },
  );

  fastify.get<{ Params: { token: string } }>(
    '/unsubscribe/:token',
    async (request, reply) => {
      const { token } = request.params;
      try {
        await subscriptionService.unsubscribe(token);
        return reply.status(200).send(
          CommonSuccessResponseDtoSchema.parse({
            message: 'Unsubscribed successfully',
          }),
        );
      } catch (error) {
        if (
          error instanceof TokenNotFoundError ||
          error instanceof InvalidTokenError
        ) {
          return reply.status(400).send({
            code: 'INVALID_TOKEN',
            error: 'Invalid or expired unsubscribe link.',
          });
        }
        throw error;
      }
    },
  );
};
