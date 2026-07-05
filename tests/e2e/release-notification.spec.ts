import { test, expect } from '@playwright/test';
import { EXISTING_REPO, NEW_RELEASE } from './mocks/github/constants.js';
import { resetTestData } from './utils/db.js';
import {
  publishGithubMockRelease,
  resetGithubMockRelease,
} from './utils/github-mock.js';
import {
  clearEmails,
  getLinkFromEmail,
  waitForEmailWithSubject,
} from './utils/email.js';

const TEST_EMAIL = 'release-e2e@example.com';
const EXISTING_REPO_FULL_NAME = `${EXISTING_REPO.owner}/${EXISTING_REPO.name}`;

test.afterEach(async ({ request }) => {
  await resetTestData();
  await resetGithubMockRelease(request);
  await clearEmails(request);
});

test('should notify the user when a new release is published', async ({
  page,
  request,
}) => {
  await page.goto('/');

  await page.fill('#repo', EXISTING_REPO_FULL_NAME);
  await page.fill('#email', TEST_EMAIL);
  await page.click('button:has-text("Subscribe to Notifications")');
  await expect(page).toHaveURL(/\/sent/);

  const confirmLink = await getLinkFromEmail(page, 'Confirm Subscription');
  await page.goto(confirmLink);

  await expect(page.locator('[data-slot="card-title"]')).toContainText(
    'Subscription Confirmed!',
  );

  await waitForEmailWithSubject(request, 'Subscription confirmed');

  await clearEmails(request);

  await publishGithubMockRelease(request, NEW_RELEASE.tag, NEW_RELEASE.name);

  await waitForEmailWithSubject(request, NEW_RELEASE.tag);

  const releaseLink = await getLinkFromEmail(page, 'View Release on GitHub');
  expect(releaseLink).toContain(NEW_RELEASE.tag);
});
