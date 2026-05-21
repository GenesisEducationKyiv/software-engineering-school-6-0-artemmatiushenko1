import type { APIRequestContext, Page } from '@playwright/test';

const MAILPIT_URL = 'http://mailpit:8025';

export const clearEmails = async (request: APIRequestContext) => {
  await request.delete(`${MAILPIT_URL}/api/v1/messages`);
};

export const getLinkFromEmail = async (page: Page, linkText: string) => {
  const latestEmailUrl = `${MAILPIT_URL}/view/latest.html`;

  let href = null;
  for (let i = 0; i < 15; i++) {
    await page.goto(latestEmailUrl);
    const link = page.getByRole('link', { name: linkText });
    if (await link.isVisible()) {
      href = await link.getAttribute('href');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!href) {
    throw new Error(
      `Link "${linkText}" not found in latest email after retries`,
    );
  }

  return href;
};
