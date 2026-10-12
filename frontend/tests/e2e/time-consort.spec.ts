/**
 * Browser integration tests render recorded Time Consort whole-night and
 * first-effect reflection fixtures in both locales. Archive captions and
 * literal seat assertions check reflection disclosure before actual deaths
 * and terminal winners; no reflection algorithm runs in this test.
 */
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const scope of ["whole_night", "first_effect"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(
      "Consort reflection is revealed before actual deaths/" + scope + "/" + locale,
      async ({ page }) => {
        const base = "frontend/tests/fixtures/time-consort-" + scope + "-" + locale;
        const replay = readReplayDocument(
          JSON.parse(readFileSync(frontendFixtureURL(base + ".replay.json"), "utf8")),
        );
        const cp = JSON.parse(
          readFileSync(frontendFixtureURL(base + ".checkpoint.txt"), "utf8"),
        ) as { players: Array<{ id: number; role: string; alive: boolean }> };
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        const lock = replay.events.find((e) => e.type === "time_consort_lock_committed")!,
          label = eventLabel(lock, locale);
        await page.locator(".timeline .event").filter({ hasText: label }).first().click();
        await expect(page.getByTestId("composition-event")).toHaveText(label);
        const dead = async () =>
          (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number);
        expect(await dead()).toEqual([]);
        const reflected = replay.events.filter((e) => e.type === "time_consort_reflected");
        expect(reflected).toHaveLength(scope === "whole_night" ? 3 : 1);
        for (const e of reflected) {
          const label = eventLabel(e, locale);
          await page.locator(".timeline .event").filter({ hasText: label }).first().click();
          await expect(page.getByTestId("composition-event")).toHaveText(label);
          expect(await dead()).toEqual([]);
        }
        const resolved = replay.events.find((e) => e.type === "night_resolved" && e.day === 1)!;
        await page
          .locator(".timeline .event")
          .filter({ hasText: eventLabel(resolved, locale) })
          .first()
          .click();
        expect(await dead()).toHaveLength(2);
        const witch = cp.players.find((p) => p.role === "witch")!.id;
        if (scope === "whole_night") {
          expect(await dead()).toContain(witch);
          expect(await dead()).not.toContain(lock.payload.targetId);
        } else {
          expect(await dead()).not.toContain(witch);
          expect(await dead()).toContain(lock.payload.targetId);
        }
        await page.locator(".timeline .event").last().click();
        expect(await dead()).toEqual(cp.players.filter((p) => !p.alive).map((p) => p.id));
        await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
      },
    );
