import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterEach,
} from 'vitest';
import Fastify from 'fastify';
import { App } from '../../src/app.js';
import { register } from 'prom-client';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/db/schema.js';
import {
  MIGRATIONS_FOLDER,
  runDatabaseMigrations,
} from '../../src/db/migrate.js';
import type { Database } from '../../src/db/types.js';
import assert from 'assert';
import {
  CommonSuccessResponseDtoSchema,
  CommonErrorResponseDtoSchema,
} from '../../src/dtos/response.dto.js';
import { parseResponse } from '../../src/utils/test.utils.js';
import { SubscriptionsResponseDtoSchema } from '../../src/dtos/subscription.dto.js';
import { AppContainer } from '../../src/dependencies.js';
import type { GithubClient } from '../../src/domain/github.js';
import type { EmailClient } from '../../src/modules/notification/application/ports/email-client.js';
import { Redis } from 'ioredis';
import { mock } from 'vitest-mock-extended';
import { TEST_APP_CONFIG } from './constants.js';
import { createFastifyServerOptions } from '../../src/infrastructure/fastify/create-fastify-server-options.js';
import { randomUUID } from 'node:crypto';
import type { Clock } from '../../src/shared-kernel/clock.js';

const subscriptionId = () => randomUUID();
const MOCK_NOW = new Date('2026-01-01T12:00:00Z');

describe('Subscription Routes Integration with PGlite', () => {
  let app: App;
  let db: Database;

  const findSubscriptionToken = async (
    targetSubscriptionId: string,
    scope: 'subscribe' | 'unsubscribe',
    token?: string,
  ) =>
    db.query.subscriptionTokens.findFirst({
      where: (tokens, { eq, and }) =>
        token
          ? and(
              eq(tokens.subscriptionId, targetSubscriptionId),
              eq(tokens.scope, scope),
              eq(tokens.token, token),
            )
          : and(
              eq(tokens.subscriptionId, targetSubscriptionId),
              eq(tokens.scope, scope),
            ),
    });

  const seedConfirmedSubscription = async (values: {
    email: string;
    repo: string;
    lastSeenTag?: string | null;
    unsubscribeExpiresAt?: Date;
  }) => {
    const id = subscriptionId();
    const subscribeToken = `subscribe-token-${id}`;
    const unsubscribeToken = `unsubscribe-token-${id}`;

    const [subscription] = await db
      .insert(schema.subscriptions)
      .values({
        id,
        email: values.email,
        repo: values.repo,
        status: 'confirmed',
        lastSeenTag: values.lastSeenTag ?? null,
      })
      .returning();

    assert(subscription);

    await db.insert(schema.subscriptionTokens).values({
      token: subscribeToken,
      subscriptionId: subscription.id,
      scope: 'subscribe',
      expiresAt: new Date('2026-01-01T13:00:00Z'),
    });

    await db.insert(schema.subscriptionTokens).values({
      token: unsubscribeToken,
      subscriptionId: subscription.id,
      scope: 'unsubscribe',
      expiresAt:
        values.unsubscribeExpiresAt ?? new Date('2026-01-01T13:00:00Z'),
    });

    return { subscription, subscribeToken, unsubscribeToken };
  };

  const githubMock = mock<GithubClient>();
  const emailMock = mock<EmailClient>();
  const redisMock = mock<Redis>();
  const clockMock = mock<Clock>();

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  beforeEach(async () => {
    register.clear();
    vi.resetAllMocks();

    githubMock.repositoryExists.mockResolvedValue(true);
    clockMock.now.mockReturnValue(MOCK_NOW);

    const fastify = Fastify(createFastifyServerOptions(TEST_APP_CONFIG));

    const container = new AppContainer(TEST_APP_CONFIG, fastify.log, db);
    container.githubClient = githubMock;
    container.emailClient = emailMock;
    container.redis = redisMock;
    container.clock = clockMock;

    const deps = container.build();
    app = await App.create(TEST_APP_CONFIG, deps, fastify);
  });

  afterEach(async () => {
    await db.delete(schema.subscriptionTokens);
    await db.delete(schema.subscriptions);
  });

  describe('POST /api/subscribe', () => {
    it('should return 200 and persist subscription in database', async () => {
      const email = 'test@example.com';
      const repo = 'owner/repo';

      const response = await app.fastify.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email, repo },
      });

      expect(response.statusCode).toBe(200);
      expect(
        parseResponse(response.body, CommonSuccessResponseDtoSchema),
      ).toEqual({
        message: 'Subscription successful. Confirmation email sent.',
      });

      const saved = await db.query.subscriptions.findFirst({
        where: (subs, { eq, and }) =>
          and(eq(subs.email, email), eq(subs.repo, repo)),
      });
      assert(saved);

      expect(saved.email).toBe(email);
      expect(saved.status).toBe('pending');

      expect(emailMock.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: `Confirm subscription: ${repo}`,
        }),
      );
    });

    describe('Error Assertions', () => {
      it('should return 400 and INVALID_EMAIL when email is missing', async () => {
        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: {
            repo: 'owner/repo',
          },
        });

        expect(response.statusCode).toBe(400);
        const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
        expect(body.code).toBe('INVALID_EMAIL');
        expect(body.error).toBe('Invalid email format: ');
      });

      it('should return 400 and INVALID_REPO_FORMAT when repo is missing', async () => {
        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: {
            email: 'test@example.com',
          },
        });

        expect(response.statusCode).toBe(400);
        const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
        expect(body.code).toBe('INVALID_REPO_FORMAT');
        expect(body.error).toBe(
          "Invalid repository format: . Expected 'owner/repo'",
        );
      });

      it('should return 404 and REPO_NOT_FOUND when repository does not exist', async () => {
        const repo = 'nonexistent/repo';
        githubMock.repositoryExists.mockResolvedValueOnce(false);

        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: {
            email: 'test@example.com',
            repo,
          },
        });

        expect(response.statusCode).toBe(404);
        const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
        expect(body.code).toBe('REPO_NOT_FOUND');
        expect(body.error).toBe(`Repository not found: ${repo}`);
      });

      it('should return 409 and ALREADY_SUBSCRIBED when user is already subscribed', async () => {
        const email = 'test@example.com';
        const repo = 'owner/repo';

        const { subscription: existingSubscription } =
          await seedConfirmedSubscription({
            email,
            repo,
          });

        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: { email, repo },
        });

        expect(response.statusCode).toBe(409);
        const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
        expect(body.code).toBe('ALREADY_SUBSCRIBED');
        expect(body.error).toBe(`${email} is already subscribed to ${repo}`);

        const allSubscriptions = await db.select().from(schema.subscriptions);
        expect(allSubscriptions).toEqual([existingSubscription]);
      });

      it('no duplicate subscription is created when user is already subscribed', async () => {
        const email = 'test@example.com';
        const repo = 'owner/repo';

        const { subscription: existingSubscription } =
          await seedConfirmedSubscription({
            email,
            repo,
          });

        await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: { email, repo },
        });

        const allSubscriptions = await db.select().from(schema.subscriptions);
        expect(allSubscriptions).toEqual([existingSubscription]);
      });

      it('should allow re-subscribing after unsubscribing', async () => {
        const email = 'test@example.com';
        const repo = 'owner/repo';

        const { subscription, unsubscribeToken } =
          await seedConfirmedSubscription({ email, repo });

        const unsubscribeResponse = await app.fastify.inject({
          method: 'GET',
          url: `/api/unsubscribe/${unsubscribeToken}`,
        });
        expect(unsubscribeResponse.statusCode).toBe(200);

        const subscribeResponse = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: { email, repo },
        });

        expect(subscribeResponse.statusCode).toBe(200);

        const updatedSubscription = await db.query.subscriptions.findFirst({
          where: (subs, { eq }) => eq(subs.id, subscription.id),
        });
        assert(updatedSubscription);
        expect(updatedSubscription.status).toBe('pending');
        expect(emailMock.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: email,
            subject: `Confirm subscription: ${repo}`,
          }),
        );
      });
    });
  });

  describe('GET /api/subscriptions', () => {
    it('should return 200 and a list of confirmed subscriptions for a valid email', async () => {
      const email = 'test@example.com';

      await seedConfirmedSubscription({ email, repo: 'owner/repo1' });

      await db.insert(schema.subscriptions).values({
        id: subscriptionId(),
        email,
        repo: 'owner/repo2',
        status: 'pending',
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: '/api/subscriptions',
        query: { email },
      });

      expect(response.statusCode).toBe(200);
      const body = parseResponse(response.body, SubscriptionsResponseDtoSchema);

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        email,
        repo: 'owner/repo1',
        confirmed: true,
      });
    });

    it('should not return subscriptions of other users', async () => {
      const targetEmail = 'target@example.com';
      const otherEmail = 'other@example.com';

      await seedConfirmedSubscription({
        email: targetEmail,
        repo: 'owner/repo-target',
      });

      await seedConfirmedSubscription({
        email: otherEmail,
        repo: 'owner/repo-other',
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: '/api/subscriptions',
        query: { email: targetEmail },
      });

      expect(response.statusCode).toBe(200);
      const body = parseResponse(response.body, SubscriptionsResponseDtoSchema);

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        email: targetEmail,
        repo: 'owner/repo-target',
        confirmed: true,
      });
    });

    it('should return 200 and an empty array when there are no confirmed subscriptions', async () => {
      const email = 'test@example.com';

      await db.insert(schema.subscriptions).values({
        id: subscriptionId(),
        email,
        repo: 'owner/repo',
        status: 'pending',
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: '/api/subscriptions',
        query: { email },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual([]);
    });

    it.each(['invalid-email', ''])(
      'should return 400 and INVALID_EMAIL when email is invalid',
      async (email) => {
        const response = await app.fastify.inject({
          method: 'GET',
          url: '/api/subscriptions',
          query: { email },
        });

        expect(response.statusCode).toBe(400);
        const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
        expect(body.code).toBe('INVALID_EMAIL');
      },
    );

    it('should return 400 and INVALID_EMAIL when email is missing', async () => {
      const response = await app.fastify.inject({
        method: 'GET',
        url: '/api/subscriptions',
      });

      expect(response.statusCode).toBe(400);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('INVALID_EMAIL');
    });
  });

  describe('GET /api/confirm/:token', () => {
    it('should return 200 and confirm the subscription for a valid token', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          status: 'pending',
        })
        .returning();

      assert(subscription);

      const subscribeTokenValue = 'valid-confirm-token';
      await db.insert(schema.subscriptionTokens).values({
        token: subscribeTokenValue,
        subscriptionId: subscription.id,
        scope: 'subscribe',
        expiresAt: new Date('2026-01-01T13:00:00Z'),
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/confirm/${subscribeTokenValue}`,
      });

      expect(response.statusCode).toBe(200);
      expect(
        parseResponse(response.body, CommonSuccessResponseDtoSchema),
      ).toEqual({
        message: 'Subscription confirmed successfully',
      });

      const updatedSubscription = await db.query.subscriptions.findFirst({
        where: (subs, { eq }) => eq(subs.id, subscription.id),
      });
      assert(updatedSubscription);
      expect(updatedSubscription.status).toBe('confirmed');

      const consumedSubscribeToken = await findSubscriptionToken(
        subscription.id,
        'subscribe',
        subscribeTokenValue,
      );
      assert(consumedSubscribeToken);
      expect(consumedSubscribeToken.usedAt).toEqual(MOCK_NOW);
    });

    it('should return 404 and SUBSCRIPTION_ALREADY_CONFIRMED when reusing an already consumed token', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          status: 'pending',
        })
        .returning();

      assert(subscription);

      const tokenValue = 'reused-confirm-token';
      await db.insert(schema.subscriptionTokens).values({
        token: tokenValue,
        subscriptionId: subscription.id,
        scope: 'subscribe',
        expiresAt: new Date('2026-01-01T13:00:00Z'),
      });

      const firstResponse = await app.fastify.inject({
        method: 'GET',
        url: `/api/confirm/${tokenValue}`,
      });

      expect(firstResponse.statusCode).toBe(200);
      expect(
        parseResponse(firstResponse.body, CommonSuccessResponseDtoSchema),
      ).toEqual({
        message: 'Subscription confirmed successfully',
      });

      const secondResponse = await app.fastify.inject({
        method: 'GET',
        url: `/api/confirm/${tokenValue}`,
      });

      expect(secondResponse.statusCode).toBe(409);
      const body = parseResponse(
        secondResponse.body,
        CommonErrorResponseDtoSchema,
      );
      expect(body.code).toBe('SUBSCRIPTION_ALREADY_CONFIRMED');
    });

    it('should return 404 and SUBSCRIPTION_NOT_FOUND when token does not exist', async () => {
      const response = await app.fastify.inject({
        method: 'GET',
        url: '/api/confirm/nonexistent-token',
      });

      expect(response.statusCode).toBe(404);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('SUBSCRIPTION_NOT_FOUND');
    });

    it('should return 400 and TOKEN_EXPIRED when token is expired', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          status: 'pending',
        })
        .returning();

      assert(subscription);

      const tokenValue = 'expired-token';
      await db.insert(schema.subscriptionTokens).values({
        token: tokenValue,
        subscriptionId: subscription.id,
        scope: 'subscribe',
        expiresAt: new Date('2026-01-01T11:00:00Z'),
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/confirm/${tokenValue}`,
      });

      expect(response.statusCode).toBe(400);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('TOKEN_EXPIRED');

      const updatedSubscription = await db.query.subscriptions.findFirst({
        where: (subs, { eq }) => eq(subs.id, subscription.id),
      });
      expect(updatedSubscription?.status).toBe('pending');
    });

    it('should return 404 and SUBSCRIPTION_NOT_FOUND when token has wrong scope', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          status: 'pending',
        })
        .returning();

      assert(subscription);

      const tokenValue = 'wrong-scope-token';
      await db.insert(schema.subscriptionTokens).values({
        token: tokenValue,
        subscriptionId: subscription.id,
        scope: 'unsubscribe',
        expiresAt: new Date('2026-01-01T13:00:00Z'),
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/confirm/${tokenValue}`,
      });

      expect(response.statusCode).toBe(404);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('SUBSCRIPTION_NOT_FOUND');
    });
  });

  describe('GET /api/unsubscribe/:token', () => {
    it('should return 200 and persist unsubscribed subscription for a valid token', async () => {
      const { subscription, unsubscribeToken: tokenValue } =
        await seedConfirmedSubscription({
          email: 'test@example.com',
          repo: 'owner/repo',
        });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/unsubscribe/${tokenValue}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: 'Unsubscribed successfully',
      });

      const updatedSubscription = await db.query.subscriptions.findFirst({
        where: (subs, { eq }) => eq(subs.id, subscription.id),
      });
      assert(updatedSubscription);
      expect(updatedSubscription.status).toBe('unsubscribed');

      const consumedUnsubscribeToken = await findSubscriptionToken(
        subscription.id,
        'unsubscribe',
        tokenValue,
      );
      assert(consumedUnsubscribeToken);
      expect(consumedUnsubscribeToken.usedAt).toEqual(MOCK_NOW);
    });

    it('should return 400 and ILLEGAL_STATE_TRANSITION when reusing an already consumed token', async () => {
      const { unsubscribeToken: tokenValue } = await seedConfirmedSubscription({
        email: 'test@example.com',
        repo: 'owner/repo',
      });

      const firstResponse = await app.fastify.inject({
        method: 'GET',
        url: `/api/unsubscribe/${tokenValue}`,
      });

      expect(firstResponse.statusCode).toBe(200);

      const secondResponse = await app.fastify.inject({
        method: 'GET',
        url: `/api/unsubscribe/${tokenValue}`,
      });

      expect(secondResponse.statusCode).toBe(400);
      const body = parseResponse(
        secondResponse.body,
        CommonErrorResponseDtoSchema,
      );
      expect(body.code).toBe('ILLEGAL_STATE_TRANSITION');
    });

    it('should return 404 and SUBSCRIPTION_NOT_FOUND when token does not exist', async () => {
      const response = await app.fastify.inject({
        method: 'GET',
        url: '/api/unsubscribe/nonexistent-token',
      });

      expect(response.statusCode).toBe(404);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('SUBSCRIPTION_NOT_FOUND');
    });

    it('should return 400 and TOKEN_EXPIRED when token is expired', async () => {
      const { subscription, unsubscribeToken: tokenValue } =
        await seedConfirmedSubscription({
          email: 'test@example.com',
          repo: 'owner/repo',
          unsubscribeExpiresAt: new Date('2026-01-01T11:00:00Z'),
        });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/unsubscribe/${tokenValue}`,
      });

      expect(response.statusCode).toBe(400);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('TOKEN_EXPIRED');

      const existingSubscription = await db.query.subscriptions.findFirst({
        where: (subs, { eq }) => eq(subs.id, subscription.id),
      });
      expect(existingSubscription?.status).toBe('confirmed');
    });

    it('should return 404 and SUBSCRIPTION_NOT_FOUND when token has wrong scope', async () => {
      const { subscribeToken: tokenValue } = await seedConfirmedSubscription({
        email: 'test@example.com',
        repo: 'owner/repo',
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/unsubscribe/${tokenValue}`,
      });

      expect(response.statusCode).toBe(404);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('SUBSCRIPTION_NOT_FOUND');
    });
  });
});
