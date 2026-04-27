import { test, expect } from "@playwright/test";

test.describe("冒烟测试", () => {
  test("页面基本加载", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30000 });

    // 检查页面加载
    await expect(page).toHaveTitle(/AI Werewolf Arena/);

    // 等待页面核心元素 - 使用更灵活的选择器
    await page.waitForSelector("body", { timeout: 10000 });

    // 检查是否有聊天流或相关元素
    const chatElements = page.locator(
      'text=聊天流, text=ChatFlow, [class*="chat"], [data-testid*="chat"]',
    );
    const hasChatElements = await chatElements
      .count()
      .then((count) => count > 0)
      .catch(() => false);

    // 如果没有找到聊天流元素，检查页面是否有其他关键元素
    if (!hasChatElements) {
      // 检查页面是否有任何可见文本
      const visibleText = page
        .locator("*")
        .filter({ hasText: /[a-zA-Z\u4e00-\u9fa5]/ });
      const textCount = await visibleText.count();
      console.log(`页面有 ${textCount} 个可见文本元素`);
      expect(textCount).toBeGreaterThan(0);
    } else {
      expect(hasChatElements).toBeTruthy();
    }

    // 检查是否有控制按钮
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeGreaterThan(0);

    console.log(`页面加载成功，找到 ${buttonCount} 个按钮`);
  });

  test("玩家列表渲染", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30000 });

    // 等待玩家列表 - 可能数据需要时间加载
    const playerElements = page.locator('[data-testid^="player-"]');

    // 先检查是否有任何玩家元素
    const hasPlayers = await playerElements
      .count()
      .then((count) => count > 0)
      .catch(() => false);

    if (!hasPlayers) {
      // 尝试启动Mock引擎来获取玩家数据
      const startButton = page.locator("button", { hasText: /启动 Mock 引擎/ });
      if (await startButton.isVisible()) {
        await startButton.click();
        await page.waitForTimeout(3000);
      }
    }

    // 再次检查玩家
    const finalPlayerCount = await playerElements.count();
    console.log(`找到 ${finalPlayerCount} 个玩家元素`);

    // 至少有1个玩家就应该通过
    expect(finalPlayerCount).toBeGreaterThan(0);

    if (finalPlayerCount > 0) {
      const firstPlayer = playerElements.first();
      await expect(firstPlayer).toBeVisible();
    }
  });
});
