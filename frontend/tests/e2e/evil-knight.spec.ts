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
            new URL(`../fixtures/evil-knight-${kind}-${locale}.replay.json`, import.meta.url),
            "utf8",
          ),
        ),
      );
      const report = replay.events.find((e) => e.type === "seer_checked")!;
      const label = eventLabel(report, locale);
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await page.locator(".timeline .event").filter({ hasText: label }).first().click();
      await expect(page.getByTestId("composition-event")).toHaveText(label);
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
