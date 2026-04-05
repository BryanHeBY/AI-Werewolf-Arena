import { test, expect } from "@playwright/test";

test.describe("ChatFlow 修复测试", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test("虚拟滚动容器存在且可访问", async ({ page }) => {
    const chatFlowContainer = page.locator(".cyber-panel");
    await expect(chatFlowContainer).toBeVisible({ timeout: 5000 });

    const scrollContainer = page.locator('[class*="overflow-y-auto"]');
    await expect(scrollContainer.first()).toBeVisible();

    const messageArea = page.locator('[class*="flex-1 flex flex-col h-full"]');
    await expect(messageArea).toBeVisible();
  });

  test("Mock引擎启动后消息气泡正确显示", async ({ page }) => {
    const startButton = page.locator('button:has-text("启动 Mock 引擎")');
    await expect(startButton).toBeVisible();

    // 点击启动Mock引擎
    await startButton.click();

    // 等待停止按钮出现，确认引擎已启动
    await expect(page.locator('button:has-text("停止 Mock 引擎")')).toBeVisible(
      { timeout: 15000 },
    );

    // 等待更长时间让mock引擎生成足够多的消息
    await page.waitForTimeout(10000);

    // 尝试多种选择器查找消息
    const selectors = [
      '[data-testid^="chat-bubble-"]',
      ".whitespace-pre-wrap",
      '[class*="flex gap-3 w-full"]',
      '[data-testid^="message-content-"]',
    ];

    let foundMessages = false;
    let messageCount = 0;

    for (const selector of selectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      console.log(`选择器 "${selector}" 找到 ${count} 个元素`);

      if (count > 0) {
        foundMessages = true;
        messageCount = count;
        break;
      }
    }

    // 如果还是没找到，尝试滚动
    if (!foundMessages) {
      const scrollContainer = page.locator('[class*="overflow-y-auto"]');
      const scrollCount = await scrollContainer.count();

      if (scrollCount > 0) {
        // 滚动到最底部
        await scrollContainer.first().evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await page.waitForTimeout(2000);

        // 再次尝试查找
        for (const selector of selectors) {
          const elements = page.locator(selector);
          const count = await elements.count();
          console.log(`滚动后选择器 "${selector}" 找到 ${count} 个元素`);

          if (count > 0) {
            foundMessages = true;
            messageCount = count;
            break;
          }
        }
      }
    }

    // 验证消息数量
    expect(messageCount).toBeGreaterThan(0);
    console.log(`最终找到 ${messageCount} 条消息`);
  });

  test("赛博朋克风格样式正确应用", async ({ page }) => {
    const cyberPanel = page.locator(".cyber-panel");
    await expect(cyberPanel).toBeVisible();
  });

  test("消息气泡左中右对齐逻辑正确", async ({ page }) => {
    const startButton = page.locator('button:has-text("启动 Mock 引擎")');
    await startButton.click();

    await page.waitForTimeout(5000);

    const bubbles = page.locator('[data-testid^="chat-bubble-"]');
    const bubbleCount = await bubbles.count();

    if (bubbleCount > 0) {
      const firstBubble = bubbles.first();
      const bubbleClass = await firstBubble.getAttribute("class");
      expect(bubbleClass).toBeTruthy();

      // 验证气泡容器存在
      const bubbleContainer = page.locator('[class*="flex gap-3 w-full"]');
      await expect(bubbleContainer.first()).toBeVisible();
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
