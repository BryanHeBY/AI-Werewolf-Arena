import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const variant of ["mapped", "cancel", "pk"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(
      "Trickster actual exile and dead-target miss/" + variant + "/" + locale,
      async ({ page }) => {
        const base = "../fixtures/trickster-" + variant + "-" + locale;
        const replay = readReplayDocument(
          JSON.parse(readFileSync(new URL(base + ".replay.json", import.meta.url), "utf8")),
        );
        const cp = JSON.parse(
          readFileSync(new URL(base + ".checkpoint.txt", import.meta.url), "utf8"),
        ) as { players: Array<{ id: number; role: string; alive: boolean }> };
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        const mapped = replay.events.find((e) => e.type === "exile_target_mapped")!;
        const label = eventLabel(mapped, locale);
        await page.locator(".timeline .event").filter({ hasText: label }).first().click();
        await expect(page.getByTestId("composition-event")).toHaveText(label);
        const dead = async () =>
          (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number);
        expect(await dead()).toHaveLength(2);
        expect(await dead()).not.toContain(mapped.payload.effectiveId);
        const out = replay.events
          .slice(replay.events.indexOf(mapped) + 1)
          .find((e) => e.type === "voted_out")!;
        expect(out.payload.target).toBe(mapped.payload.effectiveId);
        await page
          .locator(".timeline .event")
          .filter({ hasText: eventLabel(out, locale) })
          .first()
          .click();
        expect(await dead()).toContain(out.payload.target);
        const missed = replay.events.find(
          (e) => e.type === "exile_target_mapped" && e.payload.missed === true,
        )!;
        await page
          .locator(".timeline .event")
          .filter({ hasText: eventLabel(missed, locale) })
          .first()
          .click();
        expect(await dead()).toHaveLength(4);
        expect(await dead()).toContain(missed.payload.effectiveId);
        expect(await dead()).not.toContain(missed.payload.requestedId);
        await page.locator(".timeline .event").last().click();
        expect(await dead()).toEqual(cp.players.filter((p) => !p.alive).map((p) => p.id));
        expect(cp.players.find((p) => p.role === "order_prince")!.alive).toBe(true);
        await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
      },
    );
