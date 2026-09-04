import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { e2eApps } from "./test/paths.js";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  outputDir: resolve(tmpdir(), "create-tinyjoin-playwright-results"),
  globalTeardown: "./test/e2e/global-teardown.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: e2eApps.map(({ path, port }) => ({
    command: `npm --prefix ${JSON.stringify(path)} run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  })),
});
