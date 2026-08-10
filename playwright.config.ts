import {defineConfig, devices} from '@playwright/test';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {generatedTestRoot} from './test/paths.js';

const port = 4174;
const generatedClient = resolve(generatedTestRoot, 'app/client');

export default defineConfig({
  testDir: './test/e2e',
  outputDir: resolve(tmpdir(), 'create-tinygres-playwright-results'),
  globalTeardown: './test/e2e/global-teardown.ts',
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
    command: `npm --prefix ${JSON.stringify(generatedClient)} run dev -- --host 127.0.0.1 --port 4174 --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
