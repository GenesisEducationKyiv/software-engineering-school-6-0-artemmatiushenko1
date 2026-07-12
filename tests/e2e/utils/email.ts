import type { APIRequestContext, Page } from '@playwright/test';

const MAILPIT_URL = 'http://mailpit:8025';

export const clearEmails = async (request: APIRequestContext) => {
  await request.delete(`${MAILPIT_URL}/api/v1/messages`);
};

export const waitForEmailWithSubject = async (
  request: APIRequestContext,
  subjectIncludes: string,
  maxAttempts = 30,
) => {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await request.get(`${MAILPIT_URL}/api/v1/messages`);
    const data = (await response.json()) as {
      messages?: Array<{ Subject: string }>;
    };

    const found = data.messages?.some((message) =>
      message.Subject.includes(subjectIncludes),
    );

    if (found) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    `Email with subject containing "${subjectIncludes}" not found after retries`,
  );
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
