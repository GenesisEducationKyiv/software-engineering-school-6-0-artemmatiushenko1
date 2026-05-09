import type { FastifyPluginAsync } from 'fastify';
import { SubscriptionService } from '../services/subscription.service.js';
import { toSubscriptionResponseDto } from '../dtos/subscription.dto.js';

interface SubscriptionRoutesOptions {
  subscriptionService: SubscriptionService;
}

export const subscriptionRoutes: FastifyPluginAsync<
  SubscriptionRoutesOptions
> = async (fastify, opts) => {
  const { subscriptionService } = opts;

  fastify.post<{ Body: { email: string; repo: string } }>(
    '/subscribe',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'repo'],
          properties: {
            email: { type: 'string' },
            repo: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, repo } = request.body;
      await subscriptionService.subscribe(email, repo);
      return reply.status(200).send({
        message: 'Subscription successful. Confirmation email sent.',
      });
    },
  );

  fastify.get<{ Querystring: { email: string } }>(
    '/subscriptions',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email } = request.query;
      const subscriptions =
        await subscriptionService.getSubscriptionsByEmail(email);
      return reply
        .status(200)
        .send(subscriptions.map(toSubscriptionResponseDto));
    },
  );

  fastify.get<{ Params: { token: string } }>(
    '/confirm/:token',
    {
      schema: {
        params: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params;
      await subscriptionService.confirmSubscription(token);
      return reply
        .status(200)
        .send({ message: 'Subscription confirmed successfully' });
    },
  );

  fastify.get<{ Params: { token: string } }>(
    '/unsubscribe/:token',
    {
      schema: {
        params: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params;
      await subscriptionService.unsubscribe(token);
      return reply.status(200).send({ message: 'Unsubscribed successfully' });
    },
  );
};
