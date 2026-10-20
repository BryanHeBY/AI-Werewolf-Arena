/**
 * 负责浏览器集成测试发现及 Chromium／Vite 启动配置。输入为 CI 和启动环境变量；
 * 输出为 Playwright 配置和使用登记 sample 归档的本地服务命令。只管理测试启动边界，复盘渲染和游戏规则仍归应用 owner。
 */
import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { REPLAY_BROWSER_ORIGIN, VIDEO_BROWSER_ORIGIN } from "../../tooling/media-browser-hosts";

export default defineConfig({
  testDir: "../../packages/game-media/tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: REPLAY_BROWSER_ORIGIN,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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
  webServer: [
    {
      command:
        "bun --no-env-file ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
      cwd: fileURLToPath(new URL("./", import.meta.url)),
      // 显式环境字段在 Windows 和 Unix 具有相同含义，避免 shell 前缀赋值。
      env: {
        ...process.env,
        AWA_REPLAY_INPUT:
          "../../packages/game-media/tests/fixtures/six-player-mvp/sample/locale-unrecorded/god.replay.json",
      },
      url: `${REPLAY_BROWSER_ORIGIN}/src/main.tsx`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      // 视频拥有自己的 HTML 和 Vite 插件；不能借复盘的 SPA fallback 充当预览入口。
      command:
        "bun --no-env-file ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort",
      cwd: fileURLToPath(new URL("../video/", import.meta.url)),
      env: {
        ...process.env,
        // 每个用例仅通过 route mock 提供计划，禁止读取调用者本地准备目录或项目模块。
        AWA_VIDEO_PLAN_DIR: "",
        AWA_VIDEO_PROJECT_ENTRY: "",
      },
      url: `${VIDEO_BROWSER_ORIGIN}/src/video-preview.tsx`,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
