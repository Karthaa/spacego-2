import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke + accessibility tests for the public pages, run against a production
 * build in demo mode (no Supabase env: data comes from the local demo store).
 *
 *   npm run build && npm run test:e2e
 *
 * Set PLAYWRIGHT_BASE_URL to test an already-running server instead, and
 * PLAYWRIGHT_CHANNEL=chrome to use an installed Chrome instead of the bundled
 * Chromium (`npx playwright install chromium`).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], ...(channel ? { channel } : {}) } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start -- -p 3100",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
