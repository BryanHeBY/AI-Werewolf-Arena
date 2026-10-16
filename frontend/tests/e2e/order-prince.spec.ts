/**
 * 浏览器集成测试负责跳转定序王子首日／次日亮牌的两语归档。输入为原事件和 checkpoint；
 * 输出检查存活、放逐重置与终局胜者，保留字面席位预期；只展示已录决定，不选择亮牌政策。
 */
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { text, roleName } from "@ai-werewolf-arena/game-text";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const variant of ["day1", "day2"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(
      "Order Prince reveal preserves life and resets exile/" + variant + "/" + locale,
      async ({ page }) => {
        const base = "frontend/tests/fixtures/order-prince-" + variant + "-" + locale;
        const replay = readReplayDocument(
          JSON.parse(readFileSync(frontendFixtureURL(base + ".replay.json"), "utf8")),
        );
        const cp = JSON.parse(
          readFileSync(frontendFixtureURL(base + ".checkpoint.txt"), "utf8"),
        ) as { players: Array<{ id: number; role: string; alive: boolean }> };
        const prince = cp.players.find((p) => p.role === "order_prince")!.id;
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        const reset = replay.events.find((e) => e.type === "order_prince_revote_started")!;
        const label = eventLabel(
          reset,
          locale,
          replay.players.map((p: { player_id: number }) => p.player_id),
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        );
        await page.locator(".timeline .event").filter({ hasText: label }).first().click();
        await expect(page.getByTestId("composition-event")).toHaveText(label);
        await expect(page.locator("[data-composition-player]")).toHaveCount(12);
        const deadBefore = (
          await page.locator(".seat-grid .dead .seat-number").allTextContents()
        ).map(Number);
        expect(deadBefore).not.toContain(prince);
        const seat = page.locator(".seat-grid .seat").filter({
          has: page.locator(".seat-number", { hasText: new RegExp("^" + prince + "$") }),
        });
        await expect(seat).toHaveClass(/alive/);
        await expect(seat).not.toHaveClass(/dead/);
        await expect(seat).toContainText(
          text(locale, "replay.role_revealed_badge", { role: roleName("order_prince", locale) }),
        );
        expect(deadBefore).toHaveLength(variant === "day1" ? 2 : 4);
        await expect(page.getByTestId("composition-winner")).toHaveCount(0);
        await page.locator(".timeline .event").last().click();
        const dead = await page.locator(".seat-grid .dead .seat-number").allTextContents();
        expect(dead.map(Number)).toEqual(cp.players.filter((p) => !p.alive).map((p) => p.id));
        expect(cp.players.find((p) => p.id === prince)!.alive).toBe(true);
        await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
      },
    );
