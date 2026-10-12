/**
 * Defines browser integration discovery and Chromium/Vite startup from CI and
 * launch environment inputs. Outputs the Playwright configuration and a local
 * server command using the registered sample archive. It owns test transport
 * setup only; replay rendering and game rules remain in their application owners.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command:
      "AWA_REPLAY_INPUT=tests/fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json bun --no-env-file ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/src/main.tsx",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
