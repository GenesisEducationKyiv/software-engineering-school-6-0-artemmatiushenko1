import { EXISTING_REPO, NON_EXISTING_REPO } from './mocks/github/constants.js';
import { test, expect } from '@playwright/test';
import { resetTestData } from './utils/db.js';
import { resetGithubMockRelease } from './utils/github-mock.js';
import { clearEmails, getLinkFromEmail } from './utils/email.js';
import {
  confirmSubscription,
  getConfirmLink,
  subscribe,
} from './utils/subscription.js';

const TEST_EMAIL = 'test-e2e@example.com';

const EXISTING_REPO_FULL_NAME = `${EXISTING_REPO.owner}/${EXISTING_REPO.name}`;

test.afterEach(async ({ request }) => {
  await resetTestData();
  await resetGithubMockRelease(request);
  await clearEmails(request);
});

test.describe('Subscription Flow', () => {
  test('should allow a user to subscribe to a repository and confirm it', async ({
    page,
  }) => {
    await subscribe(page, { repo: EXISTING_REPO_FULL_NAME, email: TEST_EMAIL });
    await expect(page).toHaveURL(/\/sent/);
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Check your email',
    );

    await confirmSubscription(page);
    await expect(
      page.locator('text=Your subscription has been successfully confirmed'),
    ).toBeVisible();
  });

  test('should allow a user to unsubscribe', async ({ page, request }) => {
    await subscribe(page, { repo: EXISTING_REPO_FULL_NAME, email: TEST_EMAIL });
    await expect(page).toHaveURL(/\/sent/);

    const confirmLink = await getConfirmLink(page);
    await clearEmails(request);
    await page.goto(confirmLink);
    await expect(page.locator('text=Subscription Confirmed!')).toBeVisible();

    const unsubscribeLink = await getLinkFromEmail(page, 'Unsubscribe');
    await page.goto(unsubscribeLink);

    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Unsubscribed Successfully',
    );
    await expect(
      page.locator('text=You have been successfully unsubscribed'),
    ).toBeVisible();
  });

  test('should resend confirmation when re-subscribing before confirmation', async ({
    page,
    request,
  }) => {
    await subscribe(page, { repo: EXISTING_REPO_FULL_NAME, email: TEST_EMAIL });
    await expect(page).toHaveURL(/\/sent/);
    const firstConfirmLink = await getConfirmLink(page);

    await clearEmails(request);

    await subscribe(page, { repo: EXISTING_REPO_FULL_NAME, email: TEST_EMAIL });
    await expect(page).toHaveURL(/\/sent/);
    const secondConfirmLink = await getConfirmLink(page);
    expect(secondConfirmLink).not.toBe(firstConfirmLink);

    await page.goto(firstConfirmLink);
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Confirmation Failed',
    );
    await expect(page.locator('text=Subscription not found')).toBeVisible();

    await page.goto(secondConfirmLink);
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Subscription Confirmed!',
    );
  });

  test('should not allow duplicate subscriptions', async ({ page }) => {
    await subscribe(page, { repo: EXISTING_REPO_FULL_NAME, email: TEST_EMAIL });
    await expect(page).toHaveURL(/\/sent/);
    const confirmLink = await getConfirmLink(page);
    await page.goto(confirmLink);
    await expect(page.locator('text=Subscription Confirmed!')).toBeVisible();

    await subscribe(page, {
      repo: EXISTING_REPO_FULL_NAME,
      email: TEST_EMAIL,
    });

    await expect(page.locator('text=already subscribed')).toBeVisible();
  });

  test('should show an error for a non-existent repository', async ({
    page,
  }) => {
    const invalidRepo = `${NON_EXISTING_REPO.owner}/${NON_EXISTING_REPO.name}`;

    await subscribe(page, {
      repo: invalidRepo,
      email: TEST_EMAIL,
    });

    await expect(page.locator('text=not found')).toBeVisible();
  });

  test('should allow a user to re-subscribe after unsubscribing', async ({
    page,
    request,
  }) => {
    await subscribe(page, { repo: EXISTING_REPO_FULL_NAME, email: TEST_EMAIL });
    await expect(page).toHaveURL(/\/sent/);

    const confirmLink = await getConfirmLink(page);
    await clearEmails(request);
    await page.goto(confirmLink);
    await expect(page.locator('text=Subscription Confirmed!')).toBeVisible();

    const unsubLink = await getLinkFromEmail(page, 'Unsubscribe');
    await page.goto(unsubLink);
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Unsubscribed Successfully',
    );

    await subscribe(page, { repo: EXISTING_REPO_FULL_NAME, email: TEST_EMAIL });
    await expect(page).toHaveURL(/\/sent/);
  });

  test('should show an error for invalid email format', async ({ page }) => {
    await subscribe(page, {
      repo: EXISTING_REPO_FULL_NAME,
      email: 'not-an-email',
    });

    await page.locator('text=Invalid email').isVisible();
  });

  test('should show an error for invalid repository format', async ({
    page,
  }) => {
    await subscribe(page, {
      repo: 'just-repo-name',
      email: 'test@example.com',
    });

    await expect(
      page.locator('text=Repository must be in owner/repo format'),
    ).toBeVisible();
  });

  test('should show an error for an invalid confirmation token', async ({
    page,
  }) => {
    await page.goto('/confirm/invalid-token-123');
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Confirmation Failed',
    );
    await expect(page.locator('text=Subscription not found')).toBeVisible();
  });

  test('should show an error for an invalid unsubscribe token', async ({
    page,
  }) => {
    await page.goto('/unsubscribe/invalid-token-123');
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Unsubscribe Failed',
    );
    await expect(page.locator('text=Subscription not found')).toBeVisible();
  });
});
