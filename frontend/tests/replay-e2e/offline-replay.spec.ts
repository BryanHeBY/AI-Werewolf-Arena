import { expect, test } from "@playwright/test";

test("renders the configured single replay", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "six_player_mvp" })).toBeVisible();
  await expect(page.getByText("session_frontend_fixture")).toBeVisible();
  await expect(page.getByText("天黑请闭眼").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "下一事件" })).toBeVisible();
});
