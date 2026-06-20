import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
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
import type { EmailClient } from '../../src/domain/email.js';
import { Redis } from 'ioredis';
import { mock } from 'vitest-mock-extended';
import { TEST_APP_CONFIG } from './constants.js';
import { createFastifyServerOptions } from '../../src/infrastructure/fastify/create-fastify-server-options.js';
import { randomUUID } from 'node:crypto';

const subscriptionId = () => randomUUID();

describe('Subscription Routes Integration with PGlite', () => {
  let app: App;
  let db: Database;

  const githubMock = mock<GithubClient>();
  const emailMock = mock<EmailClient>();
  const redisMock = mock<Redis>();

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    db = drizzle(new PGlite(), { schema });
    await runDatabaseMigrations(db, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    register.clear();
    vi.resetAllMocks();

    githubMock.repositoryExists.mockResolvedValue(true);

    const fastify = Fastify(createFastifyServerOptions(TEST_APP_CONFIG));

    const container = new AppContainer(TEST_APP_CONFIG, fastify.log, db);
    container.githubClient = githubMock;
    container.emailClient = emailMock;
    container.redis = redisMock;

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
      expect(saved.confirmed).toBe(false);

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

        const [existingSubscription] = await db
          .insert(schema.subscriptions)
          .values({
            id: subscriptionId(),
            email,
            repo,
            confirmed: true,
          })
          .returning();

        assert(existingSubscription);

        await db.insert(schema.subscriptionTokens).values({
          token: 'valid-confirm-token',
          subscriptionId: existingSubscription.id,
          scope: 'subscribe',
          expiresAt: new Date('2026-01-01T13:00:00Z'),
        });
        await db.insert(schema.subscriptionTokens).values({
          token: 'valid-unsubscribe-token',
          subscriptionId: existingSubscription.id,
          scope: 'unsubscribe',
          expiresAt: new Date('2026-01-01T13:00:00Z'),
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

        const [existingSubscription] = await db
          .insert(schema.subscriptions)
          .values({
            id: subscriptionId(),
            email,
            repo,
            confirmed: true,
          })
          .returning();

        assert(existingSubscription);

        await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: { email, repo },
        });

        const allSubscriptions = await db.select().from(schema.subscriptions);
        expect(allSubscriptions).toEqual([existingSubscription]);
      });
    });
  });

  describe('GET /api/subscriptions', () => {
    it('should return 200 and a list of confirmed subscriptions for a valid email', async () => {
      const email = 'test@example.com';

      await db.insert(schema.subscriptions).values({
        id: subscriptionId(),
        email,
        repo: 'owner/repo1',
        confirmed: true,
      });

      await db.insert(schema.subscriptions).values({
        id: subscriptionId(),
        email,
        repo: 'owner/repo2',
        confirmed: false,
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

      await db.insert(schema.subscriptions).values({
        id: subscriptionId(),
        email: targetEmail,
        repo: 'owner/repo-target',
        confirmed: true,
      });

      await db.insert(schema.subscriptions).values({
        id: subscriptionId(),
        email: otherEmail,
        repo: 'owner/repo-other',
        confirmed: true,
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
        confirmed: false,
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
          confirmed: false,
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

      const unsubscribeTokenValue = 'valid-unsubscribe-token';
      await db.insert(schema.subscriptionTokens).values({
        token: unsubscribeTokenValue,
        subscriptionId: subscription.id,
        scope: 'unsubscribe',
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
      expect(updatedSubscription.confirmed).toBe(true);

      const subscribeTokenExists = await db.query.subscriptionTokens.findFirst({
        where: (tokens, { eq }) => eq(tokens.token, subscribeTokenValue),
      });
      expect(subscribeTokenExists).toBeUndefined();
    });

    it('should return 404 and TOKEN_NOT_FOUND when reusing an already consumed token', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmed: false,
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

      const unsubscribeTokenValue = 'valid-unsubscribe-token';
      await db.insert(schema.subscriptionTokens).values({
        token: unsubscribeTokenValue,
        subscriptionId: subscription.id,
        scope: 'unsubscribe',
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

      expect(secondResponse.statusCode).toBe(404);
      const body = parseResponse(
        secondResponse.body,
        CommonErrorResponseDtoSchema,
      );
      expect(body.code).toBe('TOKEN_NOT_FOUND');
    });

    it('should return 404 and TOKEN_NOT_FOUND when token does not exist', async () => {
      const response = await app.fastify.inject({
        method: 'GET',
        url: '/api/confirm/nonexistent-token',
      });

      expect(response.statusCode).toBe(404);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('TOKEN_NOT_FOUND');
    });

    it('should return 400 and INVALID_TOKEN when token is expired', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmed: false,
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
      expect(body.code).toBe('INVALID_TOKEN');

      const updatedSubscription = await db.query.subscriptions.findFirst({
        where: (subs, { eq }) => eq(subs.id, subscription.id),
      });
      expect(updatedSubscription?.confirmed).toBe(false);
    });

    it('should return 400 and INVALID_TOKEN when token has wrong scope', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmed: false,
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

      expect(response.statusCode).toBe(400);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('GET /api/unsubscribe/:token', () => {
    it('should return 200 and delete the subscription for a valid token', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmed: true,
        })
        .returning();

      assert(subscription);

      const tokenValue = 'valid-unsubscribe-token';
      await db.insert(schema.subscriptionTokens).values({
        token: tokenValue,
        subscriptionId: subscription.id,
        scope: 'unsubscribe',
        expiresAt: new Date('2026-01-01T13:00:00Z'),
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/unsubscribe/${tokenValue}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: 'Unsubscribed successfully',
      });

      const deletedSubscription = await db.query.subscriptions.findFirst({
        where: (subs, { eq }) => eq(subs.id, subscription.id),
      });
      expect(deletedSubscription).toBeUndefined();

      const tokenExists = await db.query.subscriptionTokens.findFirst({
        where: (tokens, { eq }) => eq(tokens.token, tokenValue),
      });
      expect(tokenExists).toBeUndefined();
    });

    it('should return 404 and TOKEN_NOT_FOUND when reusing an already consumed token', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmed: true,
        })
        .returning();

      assert(subscription);

      const tokenValue = 'reused-unsubscribe-token';
      await db.insert(schema.subscriptionTokens).values({
        token: tokenValue,
        subscriptionId: subscription.id,
        scope: 'unsubscribe',
        expiresAt: new Date('2026-01-01T13:00:00Z'),
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

      expect(secondResponse.statusCode).toBe(404);
      const body = parseResponse(
        secondResponse.body,
        CommonErrorResponseDtoSchema,
      );
      expect(body.code).toBe('TOKEN_NOT_FOUND');
    });

    it('should return 404 and TOKEN_NOT_FOUND when token does not exist', async () => {
      const response = await app.fastify.inject({
        method: 'GET',
        url: '/api/unsubscribe/nonexistent-token',
      });

      expect(response.statusCode).toBe(404);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('TOKEN_NOT_FOUND');
    });

    it('should return 400 and INVALID_TOKEN when token is expired', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmed: true,
        })
        .returning();

      assert(subscription);

      const tokenValue = 'expired-unsubscribe-token';
      await db.insert(schema.subscriptionTokens).values({
        token: tokenValue,
        subscriptionId: subscription.id,
        scope: 'unsubscribe',
        expiresAt: new Date('2026-01-01T11:00:00Z'),
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/unsubscribe/${tokenValue}`,
      });

      expect(response.statusCode).toBe(400);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('INVALID_TOKEN');

      // The subscription should still exist since the token was invalid
      const existingSubscription = await db.query.subscriptions.findFirst({
        where: (subs, { eq }) => eq(subs.id, subscription.id),
      });
      expect(existingSubscription).toBeDefined();
    });

    it('should return 400 and INVALID_TOKEN when token has wrong scope', async () => {
      const [subscription] = await db
        .insert(schema.subscriptions)
        .values({
          id: subscriptionId(),
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmed: true,
        })
        .returning();

      assert(subscription);

      const tokenValue = 'wrong-scope-unsubscribe-token';
      await db.insert(schema.subscriptionTokens).values({
        token: tokenValue,
        subscriptionId: subscription.id,
        scope: 'subscribe',
        expiresAt: new Date('2026-01-01T13:00:00Z'),
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/unsubscribe/${tokenValue}`,
      });

      expect(response.statusCode).toBe(400);
      const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
      expect(body.code).toBe('INVALID_TOKEN');
    });
  });
});
