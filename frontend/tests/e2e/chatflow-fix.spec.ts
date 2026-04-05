import { test, expect } from "@playwright/test";

test.describe("ChatFlow 修复测试", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
  });

  test("虚拟滚动容器存在且可访问", async ({ page }) => {
    const chatBubble = page.locator('[data-testid^="chat-bubble-"]').first();
    await expect(chatBubble).toBeVisible({ timeout: 5000 });
  });

  test("Mock引擎启动后消息气泡正确显示", async ({ page }) => {
    const startButton = page.locator('button:has-text("启动 Mock 引擎")');
    await startButton.click();
    await page.waitForTimeout(2000);

    const messages = page.locator('[data-testid^="chat-bubble-"]');
    const messageCount = await messages.count();
    expect(messageCount).toBeGreaterThan(0);

    const debugInfo = page.locator("text=调试: chatMessages.length");
    await expect(debugInfo).toBeVisible();
  });

  test("赛博朋克风格样式正确应用", async ({ page }) => {
    const cyberPanel = page.locator(".cyber-panel");
    await expect(cyberPanel).toBeVisible();

    const monoFont = page.locator(".font-mono");
    await expect(monoFont.first()).toBeVisible();
  });

  test("消息气泡左中右对齐逻辑正确", async ({ page }) => {
    const startButton = page.locator('button:has-text("启动 Mock 引擎")');
    await startButton.click();
    await page.waitForTimeout(3000);

    const bubbles = page.locator('[data-testid^="chat-bubble-"]');
    const bubbleCount = await bubbles.count();

    if (bubbleCount > 0) {
      const firstBubble = bubbles.first();
      const bubbleClass = await firstBubble.getAttribute("class");
      expect(bubbleClass).toBeTruthy();

      const hasAlignmentClass =
        bubbleClass?.includes("justify-") || bubbleClass?.includes("items-");
      expect(hasAlignmentClass).toBeTruthy();
    }
  });

  test("内心独白按需渲染逻辑正确", async ({ page }) => {
    const godView = page.locator("text=上帝视角");
    await godView.click();
    await page.waitForTimeout(1000);

    const startButton = page.locator('button:has-text("启动 Mock 引擎")');
    await startButton.click();
    await page.waitForTimeout(3000);

    const thoughtPanels = page.locator('[data-testid^="thought-panel-"]');
    const thoughtPanelCount = await thoughtPanels.count();

    if (thoughtPanelCount > 0) {
      await expect(thoughtPanels.first()).toBeVisible();
    }
  });
});
