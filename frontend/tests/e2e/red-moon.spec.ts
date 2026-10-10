import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { eventLabel } from "../../src/replay/event-labels";
for (const mode of ["expire", "knife", "blast"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test("Red Moon public reveal and death lifecycle " + mode + "/" + locale, async ({ page }) => {
      const base = "../fixtures/red-moon-" + mode + "-" + locale;
      const replay = readReplayDocument(
        JSON.parse(readFileSync(new URL(base + ".replay.json", import.meta.url), "utf8")),
      );
      const checkpoint = JSON.parse(
        readFileSync(new URL(base + ".checkpoint.txt", import.meta.url), "utf8"),
      ) as { players: Array<{ id: number; role: string; alive: boolean }> };
      const actor = checkpoint.players.find((p) => p.role === "red_moon_apostle")!.id;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const seat = page.getByRole("button", {
        name:
          locale === "en" ? "Player " + actor + " · Seat " + actor : actor + "号 · Seat " + actor,
        exact: true,
      });
      for (const e of replay.events.filter((e) =>
        ["red_moon_night_sealed", "red_moon_exile_delayed", "red_moon_delay_expired"].includes(
          e.type,
        ),
      )) {
        const label = eventLabel(e, locale);
        await page.locator(".timeline .event").filter({ hasText: label }).first().click();
        await expect(page.getByTestId("composition-event")).toHaveText(label);
        if (e.type === "red_moon_exile_delayed") await expect(seat).not.toHaveClass(/dead/);
        else await expect(seat).toHaveClass(/dead/);
        if (e.type !== "red_moon_delay_expired")
          await expect(seat).toContainText(
            text(locale, "replay.role_revealed_badge", {
              role: locale === "zh-CN" ? "赤月使徒" : "Red Moon Apostle",
            }),
          );
      }
      await page.locator(".timeline .event").last().click();
      const dead = await page.locator(".seat-grid .dead .seat-number").allTextContents();
      expect(dead.map(Number)).toEqual(checkpoint.players.filter((p) => !p.alive).map((p) => p.id));
      await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
    });
