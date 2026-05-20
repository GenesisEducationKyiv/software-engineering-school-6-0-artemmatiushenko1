import { describe, it, expect } from 'vitest';
import { apiRequest } from './pkg/http.js';
import { emailService, ghServer } from './setup.js';
import { getSubscriptionToken } from './pkg/db.js';

const TEST_EMAIL = 'user@example.com';
const TEST_REPO = 'owner/repo';

describe('POST /api/subscribe', () => {
  it('creates subscription and sends confirmation email', async () => {
    const res = await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();

    expect(emailService.sent).toHaveLength(1);
    const sentEmail = emailService.sent[0]!;
    expect(sentEmail.to).toBe(TEST_EMAIL);
    expect(sentEmail.subject).toContain(TEST_REPO);
    expect(sentEmail.text).toContain('/confirm/');
  });

  it('returns 409 on duplicate subscription', async () => {
    await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });

    const res = await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('ALREADY_SUBSCRIBED');
  });

  it('returns 400 on invalid email', async () => {
    const res = await apiRequest('POST', '/api/subscribe', {
      body: { email: 'not-an-email', repo: TEST_REPO },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_EMAIL');
  });

  it('returns 400 on invalid repo format', async () => {
    const res = await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: 'invalid-repo' },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_REPO_FORMAT');
  });

  it('returns 404 when repo does not exist on GitHub', async () => {
    ghServer.repoNotFound('owner', 'repo');

    const res = await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('REPO_NOT_FOUND');
  });
});

describe('GET /api/subscriptions', () => {
  it('returns empty array when no confirmed subscriptions', async () => {
    const res = await apiRequest('GET', `/api/subscriptions?email=${TEST_EMAIL}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns only confirmed subscriptions', async () => {
    await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });
    const confirmToken = await getSubscriptionToken(TEST_EMAIL, TEST_REPO, 'subscribe');
    await apiRequest('GET', `/api/confirm/${confirmToken}`);

    const res = await apiRequest('GET', `/api/subscriptions?email=${TEST_EMAIL}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].repo).toBe(TEST_REPO);
  });

  it('does not include unconfirmed subscriptions', async () => {
    await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });

    const res = await apiRequest('GET', `/api/subscriptions?email=${TEST_EMAIL}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});

describe('GET /api/confirm/:token', () => {
  it('confirms subscription with valid token', async () => {
    await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });
    const token = await getSubscriptionToken(TEST_EMAIL, TEST_REPO, 'subscribe');

    const res = await apiRequest('GET', `/api/confirm/${token}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();

    const subsRes = await apiRequest('GET', `/api/subscriptions?email=${TEST_EMAIL}`);
    const subs = await subsRes.json();
    expect(subs).toHaveLength(1);
  });

  it('returns 404 for unknown token', async () => {
    const res = await apiRequest('GET', '/api/confirm/unknown-token-xyz');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('TOKEN_NOT_FOUND');
  });

  it('returns 400 when using unsubscribe token to confirm', async () => {
    await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });
    const wrongToken = await getSubscriptionToken(TEST_EMAIL, TEST_REPO, 'unsubscribe');

    const res = await apiRequest('GET', `/api/confirm/${wrongToken}`);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_TOKEN');
  });
});

describe('GET /api/unsubscribe/:token', () => {
  it('removes subscription with valid unsubscribe token', async () => {
    await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });
    const confirmToken = await getSubscriptionToken(TEST_EMAIL, TEST_REPO, 'subscribe');
    await apiRequest('GET', `/api/confirm/${confirmToken}`);
    const unsubToken = await getSubscriptionToken(TEST_EMAIL, TEST_REPO, 'unsubscribe');

    const res = await apiRequest('GET', `/api/unsubscribe/${unsubToken}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();

    const subsRes = await apiRequest('GET', `/api/subscriptions?email=${TEST_EMAIL}`);
    const subs = await subsRes.json();
    expect(subs).toHaveLength(0);
  });

  it('returns 404 for unknown token', async () => {
    const res = await apiRequest('GET', '/api/unsubscribe/unknown-token-xyz');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('TOKEN_NOT_FOUND');
  });

  it('returns 400 when using subscribe token to unsubscribe', async () => {
    await apiRequest('POST', '/api/subscribe', {
      body: { email: TEST_EMAIL, repo: TEST_REPO },
    });
    const wrongToken = await getSubscriptionToken(TEST_EMAIL, TEST_REPO, 'subscribe');

    const res = await apiRequest('GET', `/api/unsubscribe/${wrongToken}`);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_TOKEN');
  });
});
