import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from '../index.js';
import { register } from 'prom-client';

const githubMocks = {
  repositoryExists: vi.fn().mockResolvedValue(true),
  getLatestRelease: vi
    .fn()
    .mockResolvedValue({ tagName: 'v1.0.0', publishedAt: new Date() }),
};

const repositoryMocks = {
  findByEmailAndRepo: vi.fn().mockResolvedValue(null),
  createSubscription: vi.fn().mockResolvedValue({
    id: 1,
    email: 'test@example.com',
    repo: 'owner/repo',
    confirmed: false,
    createdAt: new Date(),
  }),
  findSubscriptionsByEmail: vi.fn().mockResolvedValue([]),
  findConfirmedSubscriptionsByEmail: vi.fn().mockResolvedValue([]),
  findSubscriptionById: vi.fn().mockResolvedValue(null),
  confirmSubscription: vi.fn().mockResolvedValue(undefined),
  updateLastSeenTag: vi.fn().mockResolvedValue(undefined),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
  findToken: vi.fn().mockResolvedValue(null),
  findTokenByValue: vi.fn().mockResolvedValue(null),
  findTokenBySubscriptionIdAndScope: vi.fn().mockResolvedValue(null),
  deleteToken: vi.fn().mockResolvedValue(undefined),
  createToken: vi.fn().mockResolvedValue('token'),
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

const transactionMocks = {
  run: vi.fn().mockImplementation(async (work) => await work({})),
};

// Mock dependencies
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

vi.mock('../infrastructure/db/drizzle-transaction-manager.js', () => ({
  DrizzleTransactionManager: class {
    constructor() {
      return transactionMocks;
    }
  },
}));

vi.mock('../repositories/subscription.repository.js', () => ({
  DrizzleSubscriptionRepository: class {
    constructor() {
      return repositoryMocks;
    }
  },
}));

describe('Subscription Routes Integration', () => {
  let app: App;

  beforeEach(async () => {
    register.clear();
    vi.clearAllMocks();

    // Reset defaults for mocks
    githubMocks.repositoryExists.mockResolvedValue(true);
    repositoryMocks.findByEmailAndRepo.mockResolvedValue(null);
    repositoryMocks.findTokenByValue.mockResolvedValue(null);

    app = new App();
    await app.setup();
  });

  describe('POST /api/subscribe', () => {
    it('should return 200 when subscribing with valid data', async () => {
      const response = await app.fastify.inject({
        method: 'POST',
        url: '/api/subscribe',
        payload: {
          email: 'test@example.com',
          repo: 'owner/repo',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: 'Subscription successful. Confirmation email sent.',
      });
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
      });

      it('should return 404 and REPO_NOT_FOUND when repository does not exist', async () => {
        githubMocks.repositoryExists.mockResolvedValueOnce(false);

        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: {
            email: 'test@example.com',
            repo: 'nonexistent/repo',
          },
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.code).toBe('REPO_NOT_FOUND');
      });

      it('should return 409 and ALREADY_SUBSCRIBED when user is already subscribed', async () => {
        repositoryMocks.findByEmailAndRepo.mockResolvedValueOnce({
          id: 1,
          email: 'test@example.com',
          repo: 'owner/repo',
          confirmed: true,
          createdAt: new Date(),
          lastSeenTag: null,
        });

        const response = await app.fastify.inject({
          method: 'POST',
          url: '/api/subscribe',
          payload: {
            email: 'test@example.com',
            repo: 'owner/repo',
          },
        });

        expect(response.statusCode).toBe(409);
        const body = JSON.parse(response.body);
        expect(body.code).toBe('ALREADY_SUBSCRIBED');
      });
    });
  });
});
