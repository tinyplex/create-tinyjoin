import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  generatedSampleClient,
  generatedSupabaseClient,
} from "./test/paths.js";

const samplePort = 4174;
const supabasePort = 4175;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  outputDir: resolve(tmpdir(), "create-tinygres-playwright-results"),
  globalTeardown: "./test/e2e/global-teardown.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${samplePort}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `npm --prefix ${JSON.stringify(generatedSampleClient)} run dev -- --host 127.0.0.1 --port ${samplePort} --strictPort`,
      url: `http://127.0.0.1:${samplePort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npm --prefix ${JSON.stringify(generatedSupabaseClient)} run dev -- --host 127.0.0.1 --port ${supabasePort} --strictPort`,
      url: `http://127.0.0.1:${supabasePort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
