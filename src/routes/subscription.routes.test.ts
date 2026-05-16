import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { App } from '../index.js';
import { register } from 'prom-client';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.js';
import type { Database } from '../db/index.js';
import assert from 'assert';

const githubMocks = {
  repositoryExists: vi.fn().mockResolvedValue(true),
  getLatestRelease: vi
    .fn()
    .mockResolvedValue({ tagName: 'v1.0.0', publishedAt: new Date() }),
};

const emailMocks = {
  sendEmail: vi.fn().mockResolvedValue(undefined),
};

const redisMocks = {
  on: vi.fn(),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  quit: vi.fn().mockResolvedValue('OK'),
};

vi.mock('../infrastructure/github/octokit.client.js', () => ({
  OctokitGithubClient: class {
    constructor() {
      return githubMocks;
    }
  },
}));

vi.mock('../infrastructure/email/nodemailer.service.js', () => ({
  NodemailerEmailService: class {
    constructor() {
      return emailMocks;
    }
  },
}));

vi.mock('ioredis', () => ({
  Redis: class {
    constructor() {
      return redisMocks;
    }
  },
}));

describe('Subscription Routes Integration with PGlite', () => {
  let app: App;
  let pgDb: Database;

  beforeAll(async () => {
    const pgLiteClient = new PGlite();
    pgDb = drizzle(pgLiteClient, { schema }) as unknown as Database;
  });

  beforeEach(async () => {
    register.clear();
    vi.clearAllMocks();

    githubMocks.repositoryExists.mockResolvedValue(true);

    app = new App(pgDb);
    await app.setup();

    await pgDb.delete(schema.subscriptionTokens);
    await pgDb.delete(schema.subscriptions);
  });

  describe('POST /api/subscribe', () => {
    it('should return 200 and persist subscription in PGlite', async () => {
      const email = 'test@example.com';
      const repo = 'owner/repo';

      const response = await app.fastify.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: { email, repo },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: 'Subscription successful. Confirmation email sent.',
      });

      const saved = await pgDb.query.subscriptions.findFirst({
        where: (subs, { eq, and }) =>
          and(eq(subs.email, email), eq(subs.repo, repo)),
      });
      expect(saved).toBeDefined();
      expect(saved?.email).toBe(email);
      expect(saved?.confirmed).toBe(false);
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
        const body = JSON.parse(response.body);
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
        const body = JSON.parse(response.body);
        expect(body.code).toBe('INVALID_REPO_FORMAT');
        expect(body.error).toBe(
          "Invalid repository format: . Expected 'owner/repo'",
        );
      });

      it('should return 404 and REPO_NOT_FOUND when repository does not exist', async () => {
        const repo = 'nonexistent/repo';
        githubMocks.repositoryExists.mockResolvedValueOnce(false);

        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: {
            email: 'test@example.com',
            repo,
          },
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.code).toBe('REPO_NOT_FOUND');
        expect(body.error).toBe(`Repository not found: ${repo}`);
      });

      it('should return 409 and ALREADY_SUBSCRIBED when user is already subscribed', async () => {
        const email = 'test@example.com';
        const repo = 'owner/repo';

        const [existingSubscription] = await pgDb
          .insert(schema.subscriptions)
          .values({
            email,
            repo,
            confirmed: true,
          })
          .returning();

        assert(existingSubscription);

        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: { email, repo },
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.code).toBe('ALREADY_SUBSCRIBED');
        expect(body.error).toBe(`${email} is already subscribed to ${repo}`);

        const allSubscriptions = await pgDb.select().from(schema.subscriptions);
        expect(allSubscriptions).toEqual([existingSubscription]);
      });

      it('no duplicate subscription is created when user is already subscribed', async () => {
        const email = 'test@example.com';
        const repo = 'owner/repo';

        const [existingSubscription] = await pgDb
          .insert(schema.subscriptions)
          .values({
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

        const allSubscriptions = await pgDb.select().from(schema.subscriptions);
        expect(allSubscriptions).toEqual([existingSubscription]);
      });
    });
  });
});
