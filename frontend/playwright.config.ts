/**
 * 负责浏览器集成测试发现及 Chromium／Vite 启动配置。输入为 CI 和启动环境变量；
 * 输出为 Playwright 配置和使用登记 sample 归档的本地服务命令。只管理测试启动边界，复盘渲染和游戏规则仍归应用 owner。
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
