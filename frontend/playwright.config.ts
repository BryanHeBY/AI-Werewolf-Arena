import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/replay-e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Arch Linux系统浏览器配置
        // 注意：executablePath 可能需要在 launchOptions 中设置
        // 备选方案
        // channel: 'chrome',
      },
    },
  ],
  webServer: {
    command: "AWA_REPLAY_INPUT=tests/fixtures/sample.replay.json bunx vite --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
