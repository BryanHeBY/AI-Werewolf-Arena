/**
 * 浏览器集成测试验证恶夜骑士查验和枪政策的两语归档。输入为已结算 replay；
 * 输出检查查验、枪击及终局帧的字幕、存活席位与胜者时点，预期沿原字面数量和事件顺序，不运行对局。
 */
import { currentEventSourceText } from "../support/replay-current-event";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const kind of ["night_immune_wolf", "shot_bypass_good", "day_shot_good"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`evil knight ${kind}/${locale}: inspection does not pre-kill and gun policy reaches exact terminal board`, async ({
      page,
    }) => {
      const replay = readReplayDocument(
        JSON.parse(
          readFileSync(
            frontendFixtureURL(`frontend/tests/fixtures/evil-knight-${kind}-${locale}.replay.json`),
            "utf8",
          ),
        ),
      );
      const report = replay.events.find((e) => e.type === "seer_checked")!;
      const label = eventLabel(
        report,
        locale,
        replay.players.map((p: { player_id: number }) => p.player_id),
        replay.players.map((p: { player_id: number; name?: string }) => ({
          id: p.player_id,
          name: p.name,
        })),
      );
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await page.locator(".timeline .event").filter({ hasText: label }).first().click();
      await expect(currentEventSourceText(page)).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      await expect(page.locator("[data-composition-player]")).toHaveCount(12);
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .dead")).toHaveCount(
        kind === "night_immune_wolf" ? 4 : 6,
      );
      await expect(page.getByTestId("composition-winner")).toHaveCount(
        kind === "night_immune_wolf" ? 4 : 8,
      );
    });
