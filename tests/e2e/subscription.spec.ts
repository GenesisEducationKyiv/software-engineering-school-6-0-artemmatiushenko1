import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index.js';
import * as schema from '../../src/db/schema.js';
import { clearEmails, getLinkFromEmail } from './utils/email.js';

const TEST_EMAIL = 'test-e2e@example.com';
const TEST_REPO = 'facebook/react';

test.beforeEach(async ({ request }) => {
  await db.delete(schema.subscriptionTokens);
  await db.delete(schema.subscriptions);
  await clearEmails(request);
});

test.describe('Subscription Flow', () => {
  test('should allow a user to subscribe to a repository and confirm it', async ({
    page,
  }) => {
    await page.goto('/');

    await page.fill('#repo', TEST_REPO);
    await page.fill('#email', TEST_EMAIL);

    await page.click('button:has-text("Subscribe to Notifications")');
    await expect(page).toHaveURL(/\/sent/);
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Check your email',
    );

    const confirmLink = await getLinkFromEmail(page, 'Confirm Subscription');
    await page.goto(confirmLink);

    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Subscription Confirmed!',
    );
    await expect(
      page.locator('text=Your subscription has been successfully confirmed'),
    ).toBeVisible();
  });

  test('should allow a user to unsubscribe', async ({ page, request }) => {
    await page.goto('/');
    await page.fill('#repo', TEST_REPO);
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Subscribe to Notifications")');
    await expect(page).toHaveURL(/\/sent/);

    const confirmLink = await getLinkFromEmail(page, 'Confirm Subscription');

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

  test('should not allow duplicate subscriptions', async ({ page }) => {
    await page.goto('/');
    await page.fill('#repo', TEST_REPO);
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Subscribe to Notifications")');
    await expect(page).toHaveURL(/\/sent/);

    await page.goto('/');
    await page.fill('#repo', TEST_REPO);
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Subscribe to Notifications")');

    await expect(page.locator('text=already subscribed')).toBeVisible();
  });

  test('should show an error for a non-existent repository', async ({
    page,
  }) => {
    const invalidRepo = 'non-existent-user/non-existent-repo-12345';

    await page.goto('/');
    await page.fill('#repo', invalidRepo);
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Subscribe to Notifications")');

    await expect(page.locator('text=not found')).toBeVisible();
  });

  test('should allow a user to re-subscribe after unsubscribing', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await page.fill('#repo', TEST_REPO);
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Subscribe to Notifications")');
    await expect(page).toHaveURL(/\/sent/);

    const confirmLink = await getLinkFromEmail(page, 'Confirm Subscription');
    await clearEmails(request);
    await page.goto(confirmLink);
    await expect(page.locator('text=Subscription Confirmed!')).toBeVisible();

    const unsubLink = await getLinkFromEmail(page, 'Unsubscribe');
    await page.goto(unsubLink);
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Unsubscribed Successfully',
    );

    await page.goto('/');
    await page.fill('#repo', TEST_REPO);
    await page.fill('#email', TEST_EMAIL);
    await page.click('button:has-text("Subscribe to Notifications")');
    await expect(page).toHaveURL(/\/sent/);
  });

  test('should show an error for invalid email format', async ({ page }) => {
    await page.goto('/');
    await page.fill('#repo', TEST_REPO);
    await page.fill('#email', 'not-an-email');
    await page.click('button:has-text("Subscribe to Notifications")');

    await page.locator('text=Invalid email').isVisible();
  });

  test('should show an error for invalid repository format', async ({
    page,
  }) => {
    await page.goto('/');
    await page.fill('#repo', 'just-repo-name');
    await page.fill('#email', 'test@example.com');
    await page.click('button:has-text("Subscribe to Notifications")');

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
    await expect(page.locator('text=Token not found')).toBeVisible();
  });

  test('should show an error for an invalid unsubscribe token', async ({
    page,
  }) => {
    await page.goto('/unsubscribe/invalid-token-123');
    await expect(page.locator('[data-slot="card-title"]')).toContainText(
      'Unsubscribe Failed',
    );
    await expect(page.locator('text=Token not found')).toBeVisible();
  });
});
