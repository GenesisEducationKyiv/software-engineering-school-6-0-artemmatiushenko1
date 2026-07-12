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
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/db/schema.js';
import { migrationModules } from '../../src/db/migrations.js';
import { runAllDatabaseMigrations } from '../../src/platform/db/migrate.js';
import type { Database } from '../../src/platform/db/types.js';
import assert from 'assert';
import {
  CommonSuccessResponseDtoSchema,
  CommonErrorResponseDtoSchema,
} from '../../src/platform/http/response.dto.js';
import { parseResponse } from './utils/parse-response.js';
import { SubscriptionsResponseDtoSchema } from '../../src/modules/subscription/infrastructure/http/subscriptions-response.dto.js';
import { AppContainer, type AppDependencies } from '../../src/dependencies.js';
import type { GithubClient } from '../../src/modules/github/api/github-client.interface.js';
import type { EmailClient } from '../../src/modules/notification/application/ports/email-client.js';
import { FastifyLogger } from '../../src/platform/logger/fastify-logger.js';
import { Redis } from 'ioredis';
import { mock } from 'vitest-mock-extended';
import { FakeScheduler } from '../../src/platform/scheduler/fake-scheduler.js';
import { TEST_APP_CONFIG } from './constants.js';
import { createFastifyServerOptions } from '../../src/platform/fastify/create-fastify-server-options.js';
import { randomUUID } from 'node:crypto';
import type { Clock } from '../../src/shared-kernel/clock.js';
import { SubscriptionTokenScope } from '../../src/modules/subscription/domain/subscription-token-scope.js';

const subscriptionId = () => randomUUID();
const FIXED_NOW = new Date('2026-01-01T12:00:00Z');

describe('Subscription Routes Integration with PGlite', () => {
  let app: App;
  let db: Database<typeof schema>;
  let deps: AppDependencies;

  const findSubscriptionToken = async (
    targetSubscriptionId: string,
    scope: SubscriptionTokenScope,
    token?: string,
  ) => {
    const subscription = await db.query.subscriptions.findFirst({
      where: (subs, { eq }) => eq(subs.id, targetSubscriptionId),
    });

    if (!subscription) {
      return undefined;
    }

    if (scope === SubscriptionTokenScope.Confirm) {
      if (token && subscription.confirmToken !== token) {
        return undefined;
      }

      return {
        token: subscription.confirmToken,
        usedAt: subscription.confirmUsedAt,
      };
    }

    if (token && subscription.unsubscribeToken !== token) {
      return undefined;
    }

    return {
      token: subscription.unsubscribeToken,
      usedAt: subscription.unsubscribeUsedAt,
    };
  };

  const seedConfirmedSubscription = async (values: {
    email: string;
    repo: string;
  }) => {
    const id = subscriptionId();
    const confirmToken = randomUUID();
    const unsubscribeToken = randomUUID();

    const [subscription] = await db
      .insert(schema.subscriptions)
      .values({
        id,
        email: values.email,
        repo: values.repo,
        status: 'confirmed',
        confirmToken,
        confirmExpiresAt: new Date('2026-01-01T13:00:00Z'),
        confirmUsedAt: new Date('2026-01-01T12:00:00Z'),
        unsubscribeToken,
      })
      .returning();

    assert(subscription);

    return { subscription, subscribeToken: confirmToken, unsubscribeToken };
  };

  const seedPendingSubscription = async (values: {
    email: string;
    repo: string;
    confirmToken?: string;
    confirmExpiresAt?: Date;
    unsubscribeToken?: string;
  }) => {
    const id = subscriptionId();
    const confirmToken = values.confirmToken ?? randomUUID();

    const [subscription] = await db
      .insert(schema.subscriptions)
      .values({
        id,
        email: values.email,
        repo: values.repo,
        status: 'pending',
        confirmToken,
        confirmExpiresAt:
          values.confirmExpiresAt ?? new Date('2026-01-01T13:00:00Z'),
        unsubscribeToken: values.unsubscribeToken,
      })
      .returning();

    assert(subscription);

    return { subscription, confirmToken };
  };

  const githubMock = mock<GithubClient>();
  const emailMock = mock<EmailClient>();
  const redisMock = mock<Redis>();
  const clockMock = mock<Clock>();
  const scheduler = new FakeScheduler();

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await runAllDatabaseMigrations(db, migrationModules);
  });

  beforeEach(async () => {
    vi.resetAllMocks();

    githubMock.repositoryExists.mockResolvedValue(true);
    githubMock.getLatestRelease.mockResolvedValue({
      tag: 'v1.0.0',
      name: 'v1.0.0',
      publishedAt: null,
    });
    clockMock.now.mockReturnValue(FIXED_NOW);
    scheduler.scheduledTasks.length = 0;
    scheduler.stopCalls = 0;

    const fastify = Fastify(createFastifyServerOptions(TEST_APP_CONFIG));

    const container = new AppContainer(TEST_APP_CONFIG, {
      db,
      logger: new FastifyLogger(fastify.log),
      redis: redisMock,
      githubClient: githubMock,
      emailClient: emailMock,
      clock: clockMock,
      scheduler,
    });

    deps = container.build();
    app = await App.create(TEST_APP_CONFIG, container, fastify);
  });

  const relayEvents = () => scheduler.invokeLatest();

  afterEach(async () => {
    await deps.outboxRelay.stop();
    await db.delete(schema.outboxMessages);
    await db.delete(schema.repoWatchers);
    await db.delete(schema.monitoredRepos);
    await db.delete(schema.notificationRecipients);
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

      await relayEvents();

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

        await seedConfirmedSubscription({ email, repo });

        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: { email, repo },
        });

        expect(response.statusCode).toBe(409);
        const body = parseResponse(response.body, CommonErrorResponseDtoSchema);
        expect(body.code).toBe('ALREADY_SUBSCRIBED');
        expect(body.error).toBe(`${email} is already subscribed to ${repo}`);
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
        await relayEvents();

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

      await seedPendingSubscription({ email, repo: 'owner/repo2' });

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

      await seedPendingSubscription({ email, repo: 'owner/repo' });

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
      const subscribeTokenValue = randomUUID();
      const { subscription } = await seedPendingSubscription({
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmToken: subscribeTokenValue,
      });

      const response = await app.fastify.inject({
        method: 'GET',
        url: `/api/confirm/${subscribeTokenValue}`,
      });

      expect(response.statusCode).toBe(200);
      await relayEvents();
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
      expect(githubMock.getLatestRelease).toHaveBeenCalledWith('owner', 'repo');

      const watcher = await db.query.repoWatchers.findFirst({
        where: (watchers, { eq }) =>
          eq(watchers.subscriptionId, subscription.id),
      });
      assert(watcher);
      expect(watcher.lastNotifiedTag).toBe('v1.0.0');

      const consumedSubscribeToken = await findSubscriptionToken(
        subscription.id,
        SubscriptionTokenScope.Confirm,
        subscribeTokenValue,
      );
      assert(consumedSubscribeToken);
      expect(consumedSubscribeToken.usedAt).toEqual(FIXED_NOW);
    });

    it('should return 409 and SUBSCRIPTION_ALREADY_CONFIRMED when reusing an already consumed token', async () => {
      const tokenValue = randomUUID();
      await seedPendingSubscription({
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmToken: tokenValue,
      });

      const firstResponse = await app.fastify.inject({
        method: 'GET',
        url: `/api/confirm/${tokenValue}`,
      });

      expect(firstResponse.statusCode).toBe(200);
      await relayEvents();
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
      const tokenValue = randomUUID();
      const { subscription } = await seedPendingSubscription({
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmToken: tokenValue,
        confirmExpiresAt: new Date('2026-01-01T11:00:00Z'),
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
      const tokenValue = randomUUID();
      await seedPendingSubscription({
        email: 'test@example.com',
        repo: 'owner/repo',
        confirmToken: randomUUID(),
        unsubscribeToken: tokenValue,
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
        SubscriptionTokenScope.Unsubscribe,
        tokenValue,
      );
      assert(consumedUnsubscribeToken);
      expect(consumedUnsubscribeToken.usedAt).toEqual(FIXED_NOW);
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
