import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE, BASE_URL } from "./e2e/env";

// End-to-end tests drive the real app on the LOCAL dev server only
// (`npm run dev` -> DEV Convex deployment + DEV Clerk instance from .env.local).
// Never point this at production.

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  outputDir: "e2e/artifacts/test-results",
  globalSetup: "./e2e/global-setup.ts",
  // Every signed-in test shares one dev account, so run one test at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "e2e/artifacts/report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    storageState: AUTH_FILE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      // Word audio is played ~2s after the Roll click; let headless Chromium
      // play it so the <audio> src (the spoken word) is always set.
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
