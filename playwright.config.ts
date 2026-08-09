import {defineConfig, devices} from '@playwright/test';

const port = 4174;

export default defineConfig({
  testDir: './test/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
  webServer: {
    command:
      'npm --prefix test/.test-output/generated/app/client run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
