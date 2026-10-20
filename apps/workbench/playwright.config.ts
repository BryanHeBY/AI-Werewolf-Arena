/** 负责工作台真实浏览器测试启动；输入构建后的应用和合成临时工作区，输出独立服务与失败证据。只使用本机模型，不读取个人目录。 */
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "html",
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4319",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun --no-env-file tests/support/browser-server.ts",
    url: "http://127.0.0.1:4319/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
