import { test, expect } from "@playwright/test";

test.describe("AI Werewolf Arena - E2E Tests", () => {
  test("page mounts and renders initial UI", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("竞技场监控器");
    await expect(page.locator("text=开始模拟")).toBeVisible();
    await expect(page.locator("text=暂停")).toBeVisible();
    await expect(page.locator("text=下一步")).toBeVisible();
    await expect(page.locator("text=重置")).toBeVisible();
    await expect(page.locator("text=游戏日志")).toBeVisible();
  });

  test("control panel buttons are interactive", async ({ page }) => {
    await page.goto("/");

    const startButton = page.locator("button", { hasText: "开始模拟" });
    const pauseButton = page.locator("button", { hasText: "暂停" });
    const nextStepButton = page.locator("button", { hasText: "下一步" });
    const resetButton = page.locator("button", { hasText: "重置" });

    await expect(startButton).toBeEnabled();
    await expect(pauseButton).toBeDisabled();
    await expect(nextStepButton).toBeEnabled();
    await expect(resetButton).toBeEnabled();

    await nextStepButton.click();

    await page.waitForTimeout(1500);

    await expect(
      page.locator('.player-card, [data-testid*="player"]'),
    ).toHaveCount(6);
  });

  test("starting mock game loads players", async ({ page }) => {
    await page.goto("/");

    const startButton = page.locator("button", { hasText: "开始模拟" });
    await startButton.click();

    await page.waitForTimeout(2500);

    await expect(page.locator('[data-testid*="player"]')).toHaveCount(6);
  });

  test("phase changes update top bar", async ({ page }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });

    const phaseBadge = page.locator("text=Night_Start");
    await expect(phaseBadge).toBeVisible();

    for (let i = 0; i < 3; i++) {
      await nextStepButton.click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator("text=Night_Start")).toBeVisible();
  });

  test("player cards display correct information", async ({ page }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });
    await nextStepButton.click();

    await page.waitForTimeout(1500);

    const playerCards = page.locator('[data-testid*="player"]');
    await expect(playerCards).toHaveCount(6);

    const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"];
    for (const name of names) {
      await expect(page.locator(`text=${name}`)).toBeVisible();
    }
  });

  test("log terminal appends messages", async ({ page }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });
    await nextStepButton.click();

    await page.waitForTimeout(1500);

    await expect(page.locator("text=GAME LOG")).toBeVisible();
    await expect(page.locator("text=Entries")).toBeVisible();
  });

  test("thinking indicator shows when agent is thinking", async ({ page }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });
    await nextStepButton.click();

    await page.waitForTimeout(1500);

    await nextStepButton.click();
    await page.waitForTimeout(2000);

    await expect(page.locator(".animate-pulse")).toBeVisible();
  });

  test("wolf and villager counts display correctly", async ({ page }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });
    await nextStepButton.click();

    await page.waitForTimeout(1500);

    await expect(page.locator("text=Wolves: 2")).toBeVisible();
    await expect(page.locator("text=Villagers: 4")).toBeVisible();
  });

  test("dead players show glitched/grayed state", async ({ page }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });

    for (let i = 0; i < 15; i++) {
      await nextStepButton.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.locator(".glitch-effect")).toBeVisible();
  });

  test("game over shows winner declaration", async ({ page }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });

    for (let i = 0; i < 30; i++) {
      await nextStepButton.click();
      await page.waitForTimeout(800);
    }

    await expect(page.locator("text=WINS!")).toBeVisible();
  });

  test("pause button stops game progression", async ({ page }) => {
    await page.goto("/");

    const startButton = page.locator("button", { hasText: "开始模拟" });
    const pauseButton = page.locator("button", { hasText: "暂停" });

    await startButton.click();

    await page.waitForTimeout(3000);

    await expect(pauseButton).toBeEnabled();

    await pauseButton.click();
    await page.waitForTimeout(1000);

    await expect(startButton).toBeEnabled();
  });

  test("reset button clears game state", async ({ page }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });
    const resetButton = page.locator("button", { hasText: "重置" });

    for (let i = 0; i < 5; i++) {
      await nextStepButton.click();
      await page.waitForTimeout(1000);
    }

    await resetButton.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Round 1")).toBeVisible();
  });

  test("log entries have different styles for thoughts vs actions", async ({
    page,
  }) => {
    await page.goto("/");

    const nextStepButton = page.locator("button", { hasText: "下一步" });

    for (let i = 0; i < 5; i++) {
      await nextStepButton.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.locator(".italic")).toBeVisible();
    await expect(page.locator(".text-neon-cyan")).toBeVisible();
  });

  test("auto-play mode works continuously", async ({ page }) => {
    await page.goto("/");

    const startButton = page.locator("button", { hasText: "开始模拟" });
    await startButton.click();

    await page.waitForTimeout(5000);

    await expect(page.locator("text=Round 1")).toBeVisible();
  });
});
