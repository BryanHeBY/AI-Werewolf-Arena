import { expect, test } from "@playwright/test";

test("renders the offline replay import screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "狼人杀复盘播放器" })).toBeVisible();
  await expect(page.getByText("打开 .replay.json")).toBeVisible();
});
