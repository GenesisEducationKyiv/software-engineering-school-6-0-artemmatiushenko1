import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run start',
      url: 'http://localhost:3000',
      timeout: 120 * 1000,
      stdout: 'pipe',
      env: {
        GITHUB_API_URL: 'http://localhost:9090',
      },
    },
    {
      command: 'npx tsx src/e2e/mocks/github/github-server.mock.ts',
      url: 'http://localhost:9090/health',
      timeout: 120 * 1000,
      stdout: 'pipe',
    },
  ],
});
