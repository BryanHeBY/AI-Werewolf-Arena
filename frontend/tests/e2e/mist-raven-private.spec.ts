/**
 * Browser integration tests build minimal render inputs from actual Mist
 * Raven alchemist, raven and villager player-view fixtures. Assertions seek
 * and rewind the owner-visible events in both locales, checking private labels,
 * hidden identities and winner timing without adding God-view information.
 */
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { createReplayRenderInput } from "../../src/replay/replay-frame";
import { eventLabel } from "../../src/replay/event-labels";
import { roleName } from "../../src/replay/replay-localization";
for (const actor of ["alchemist", "raven", "villager"] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist actual owner minimal movie input and rewind/${actor}/${locale}`, async ({
      page,
    }) => {
      const name = `mist-normal-linked-${locale}`;
      const god = readReplayDocument(
        JSON.parse(
          readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}.replay.json`), "utf8"),
        ),
      );
      const view = readReplayPlayerView(
        JSON.parse(
          readFileSync(
            frontendFixtureURL(`frontend/tests/fixtures/player-views/${name}-${actor}.player.json`),
            "utf8",
          ),
        ),
      );
      const events = view.timeline.flatMap((row) =>
        row.kind === "event"
          ? [
              {
                seq: row.seq,
                timestamp: row.timestamp!,
                day: row.day,
                phase: row.phase,
                type: row.event.type,
                payload: row.event.payload,
              },
            ]
          : [],
      );
      // Minimal render contract using actual authorized archive, not a private-file UI import.
      const replay = readReplayDocument({
        ...god,
        result: { winner: null, reason: "private_render" },
        players: god.players.map((p) => ({
          ...p,
          role: p.player_id === view.player_id ? view.role : "unknown",
          camp: p.player_id === view.player_id ? view.camp : "unknown",
        })),
        events: events.map((e, i) => ({ ...e, seq: i + 1 })),
      });
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      const type =
        actor === "alchemist"
          ? "alchemist_snake_chosen"
          : actor === "raven"
            ? "raven_unsealed"
            : "night_resolved";
      const event = replay.events.find((e) => e.type === type && e.day === 2)!;
      const label = eventLabel(event, locale);
      await page.locator(".timeline .event").filter({ hasText: label }).first().click();
      await expect(page.getByTestId("composition-event")).toHaveText(label);
      for (const p of replay.players) {
        await expect(page.locator(`[data-composition-player="${p.player_id}"]`)).toContainText(
          roleName(p.player_id === view.player_id ? view.role : "unknown", locale),
        );
      }
      if (actor !== "alchemist")
        expect(replay.events.some((e) => e.type.startsWith("alchemist_"))).toBe(false);
      if (actor !== "raven")
        expect(replay.events.some((e) => e.type.startsWith("raven_"))).toBe(false);
      const index = input.replay.events.findIndex((e) => e.seq === event.seq);
      const slider = page.locator('.frame-control input[type="range"]');
      for (const frame of [index * 90 + 45, index * 90 - 1, 0]) {
        await slider.evaluate((el, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            el,
            String(value),
          );
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, frame);
        await expect(slider).toHaveValue(String(frame));
        await expect(page.getByTestId("composition-event")).toHaveAttribute(
          "data-event-seq",
          String(input.replay.events[Math.floor(frame / 90)]!.seq),
        );
        await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      }
      expect(await page.locator(".seat-grid .dead .seat-number").allTextContents()).toEqual([]);
    });
