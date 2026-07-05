import { expect, type Page } from '@playwright/test';
import { getLinkFromEmail } from './email.js';

export const subscribe = async (
  page: Page,
  { repo, email }: { repo: string; email: string },
) => {
  await page.goto('/');
  await page.fill('#repo', repo);
  await page.fill('#email', email);
  await page.click('button:has-text("Subscribe to Notifications")');
};

export const getConfirmLink = async (page: Page) =>
  getLinkFromEmail(page, 'Confirm Subscription');

export const confirmSubscription = async (page: Page) => {
  const confirmLink = await getConfirmLink(page);
  await page.goto(confirmLink);
  await expect(page.locator('[data-slot="card-title"]')).toContainText(
    'Subscription Confirmed!',
  );
  return confirmLink;
};
