/**
 * 浏览器集成测试负责正向跳转并回看雾鸦板子的警徽链。输入为两语归档事件；
 * 输出按手写持徽者／存活预期检查每次移交和无提前胜者，字幕沿现行展示函数对照；测试不实际移交警徽。
 */
import { currentEventSourceText } from "../support/replay-current-event";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const locale of ["en", "zh-CN"] as const)
  test(`Mist literal badge 10 to pending 5 to 6 and reverse/${locale}`, async ({ page }) => {
    const r = readReplayDocument(
      JSON.parse(
        readFileSync(
          frontendFixtureURL(
            `frontend/tests/fixtures/mist-manual-blast-badge-chain-${locale}.replay.json`,
          ),
          "utf8",
        ),
      ),
    );
    await page.route("**/api/replay", (route) => route.fulfill({ json: r }));
    await page.goto("/");
    const blast = r.events.find((e) => e.type === "wolf_self_destruct")!;
    const first = r.events.find(
      (e) => e.type === "sheriff_badge_transferred" && e.payload.fromId === 10,
    )!;
    const snake = r.events.find((e) => e.type === "alchemist_snake_chosen" && e.day === 1)!;
    const night = r.events.find((e) => e.type === "night_resolved" && e.day === 1)!;
    const second = r.events.find(
      (e) => e.type === "sheriff_badge_transferred" && e.payload.fromId === 5,
    )!;
    for (const [e, holder, living] of [
      [blast, 10, false],
      [first, 5, true],
      [snake, 5, true],
      [night, 5, false],
      [second, 6, true],
      [night, 5, false],
      [snake, 5, true],
      [blast, 10, false],
    ] as const) {
      const label = eventLabel(
        e,
        locale,
        r.players.map((p: { player_id: number }) => p.player_id),
        r.players.map((p: { player_id: number; name?: string }) => ({
          id: p.player_id,
          name: p.name,
        })),
      );
      await page.locator(".timeline .event").filter({ hasText: label }).first().click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      expect(
        (
          await page
            .locator(".seat-grid .seat")
            .filter({ has: page.locator(".sheriff") })
            .locator(".seat-number")
            .allTextContents()
        ).map(Number),
      ).toEqual([holder]);
      await expect(
        page.locator(`[data-composition-player="${holder}"] [data-sheriff-badge]`),
      ).toHaveAttribute("aria-label", locale === "en" ? "Sheriff" : "警长");
      await expect(page.locator(`[data-composition-player="${holder}"]`)).toHaveAttribute(
        "data-player-alive",
        String(living),
      );
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
    }
  });
