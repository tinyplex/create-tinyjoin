import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { generatedOpfsClient } from "./test/paths.js";

const demoPort = 4174;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  outputDir: resolve(tmpdir(), "create-tinygres-playwright-results"),
  globalTeardown: "./test/e2e/global-teardown.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${demoPort}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm --prefix ${JSON.stringify(generatedOpfsClient)} run dev -- --host 127.0.0.1 --port ${demoPort} --strictPort`,
    url: `http://127.0.0.1:${demoPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
