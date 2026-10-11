import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
import { createReplayRenderInput } from "../../src/replay/replay-frame";
const cases = [
  "last-wolf-borrow-backlash",
  "last-villager-saved-then-double-cause",
  "last-god-restored-dream-gap",
  "borrowed-dream-death-badge-words",
  "independent-stock-card16-card17",
  "zero-one-then-empty",
  "one-zero-borrow-heal",
];
for (const variant of cases)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Radiant actual replay frame, night disclosure and rewind/${variant}/${locale}`, async ({
      page,
    }) => {
      const name = `radiant-${variant}-${locale}`;
      const replay = readReplayDocument(
        JSON.parse(
          readFileSync(new URL(`../fixtures/${name}.replay.json`, import.meta.url), "utf8"),
        ),
      );
      const cp = JSON.parse(
        readFileSync(new URL(`../fixtures/${name}.checkpoint.txt`, import.meta.url), "utf8"),
      ) as { players: Array<{ id: number; alive: boolean }> };
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const dead = async () =>
        (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number);
      const expected = (index: number) => {
        const deaths = new Set<number>();
        for (const e of replay.events.slice(0, index + 1)) {
          if (e.type === "night_resolved")
            for (const id of e.payload.deaths as number[]) deaths.add(id);
          if (e.type === "wolf_self_destruct") deaths.add(Number(e.payload.wolfId));
          if (e.type === "voted_out") deaths.add(Number(e.payload.target));
        }
        return [...deaths].sort((a, b) => a - b);
      };
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      const seek = async (frame: number) => {
        const slider = page.locator('.frame-control input[type="range"]');
        await slider.evaluate((el, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            el,
            String(value),
          );
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, frame);
        await expect(slider).toHaveValue(String(frame));
      };
      const compositionDead = async () =>
        page
          .locator("[data-composition-player]")
          .evaluateAll((nodes) =>
            nodes
              .filter((n) => Number((n as HTMLElement).style.opacity) < 1)
              .map((n) => Number(n.getAttribute("data-composition-player"))),
          );
      const critical = replay.events.filter((e) =>
        [
          "radiant_shelter_chosen",
          "eclipse_swallowed",
          "eclipse_native_suppressed",
          "eclipse_native_restored",
          "eclipse_lease_closed",
          "dream_death",
          "wolf_self_destruct",
          "night_resolved",
          "sheriff_badge_transferred",
          "game_over",
        ].includes(e.type),
      );
      for (const e of critical) {
        const label = eventLabel(e, locale);
        await page
          .locator(".timeline .event")
          .filter({ hasText: `#${e.seq} ·` })
          .click();
        await expect(page.getByTestId("composition-event")).toHaveText(label);
        expect(await dead()).toEqual(expected(replay.events.findIndex((x) => x.seq === e.seq)));
        expect(await compositionDead()).toEqual(
          expected(replay.events.findIndex((x) => x.seq === e.seq)),
        );
        const frameIndex = input.replay.events.findIndex((x) => x.seq === e.seq);
        await seek(frameIndex * 90 + 45);
        await expect(page.getByTestId("composition-event")).toHaveText(label);
        expect(await compositionDead()).toEqual(
          expected(replay.events.findIndex((x) => x.seq === e.seq)),
        );
        if (frameIndex > 0) {
          await seek(frameIndex * 90 - 1);
          await expect(page.getByTestId("composition-event")).toHaveAttribute(
            "data-event-seq",
            String(input.replay.events[frameIndex - 1]!.seq),
          );
          const previous = expected(
            replay.events.findIndex((x) => x.seq === input.replay.events[frameIndex - 1]!.seq),
          );
          expect(await dead()).toEqual(previous);
          expect(await compositionDead()).toEqual(previous);
          await seek(frameIndex * 90 + 45);
        }
        if (e.type === "sheriff_badge_transferred") {
          const holder = Number(e.payload.toId);
          expect(
            (
              await page
                .locator(".seat-grid .seat")
                .filter({ has: page.locator(".sheriff") })
                .locator(".seat-number")
                .allTextContents()
            ).map(Number),
          ).toEqual([holder]);
          await expect(page.locator(`[data-composition-player="${holder}"]`)).toContainText(
            locale === "en" ? "Sheriff" : "警长",
          );
        }
        if (e.type !== "game_over")
          await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      }
      const final = cp.players.filter((p) => !p.alive).map((p) => p.id);
      await page.locator(".timeline .event").last().click();
      expect(await dead()).toEqual(final);
      await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
      await page.locator(".timeline .event").first().click();
      expect(await dead()).toEqual([]);
      await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      const other = locale === "en" ? "zh-CN" : "en";
      await page.locator(".display-controls select").nth(0).selectOption(other);
      await page.locator(".display-controls select").nth(1).selectOption("UTC");
      expect(await dead()).toEqual([]);
      await page.locator(".timeline .event").last().click();
      expect(await dead()).toEqual(final);
      await page.reload();
      await page.locator(".timeline .event").last().click();
      expect(await dead()).toEqual(final);
    });
