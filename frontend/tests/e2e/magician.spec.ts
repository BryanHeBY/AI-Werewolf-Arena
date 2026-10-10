import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const policy of ["original", "exchanged"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(`Magician exchange preserves seats and night miss causes no extra death/${policy}/${locale}`, async ({
      page,
    }) => {
      const base = "../fixtures/magician-" + policy + "-" + locale;
      const replay = readReplayDocument(
        JSON.parse(readFileSync(new URL(base + ".replay.json", import.meta.url), "utf8")),
      );
      const cp = JSON.parse(
        readFileSync(new URL(base + ".checkpoint.txt", import.meta.url), "utf8"),
      ) as { players: Array<{ id: number; role: string; alive: boolean }> };
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const exchange = replay.events.find((e) => e.type === "magician_exchange_committed")!;
      const label = eventLabel(exchange, locale);
      await page.locator(".timeline .event").filter({ hasText: label }).first().click();
      await expect(page.getByTestId("composition-event")).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
      await expect(page.locator("[data-composition-player]")).toHaveCount(12);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      if (policy === "exchanged") {
        const miss = replay.events.find((e) => e.type === "death_shot_missed")!;
        const missLabel = eventLabel(miss, locale);
        await page.locator(".timeline .event").filter({ hasText: missLabel }).first().click();
        await expect(page.getByTestId("composition-event")).toHaveText(missLabel);
        await expect(page.locator(".seat-grid .dead")).toHaveCount(2);
      }
      await page.locator(".timeline .event").last().click();
      const dead = await page.locator(".seat-grid .dead .seat-number").allTextContents();
      expect(dead.map(Number)).toEqual(cp.players.filter((p) => !p.alive).map((p) => p.id));
      await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
    });
