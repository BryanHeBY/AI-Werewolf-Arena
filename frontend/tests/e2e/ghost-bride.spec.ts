/**
 * Browser integration tests render actual Ghost Bride God and owner-view
 * fixtures across partner, witness and terminal-night outcomes. Archive and
 * checkpoint facts supply assertions for native identities, private marriage
 * visibility, deaths and three-faction winners in both locales. Rendering
 * consumes those settled records without resolving marriage or victory.
 */
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { ghostBrideEventLabel } from "@ai-werewolf-arena/game-text";
import { eventLabel } from "../../src/replay/event-labels";
const read = (name: string) =>
  JSON.parse(readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}`), "utf8"));
for (const kind of ["good", "wolf", "pair", "witness"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${kind}/${locale}: actual Ghost Bride God archive preserves native partner identities and terminal three-faction winners`, async ({
      page,
    }) => {
      const replay = read(`ghost-bride-${kind}.replay.json`);
      replay.meta.locale = locale;
      const group = replay.events.find((e: any) => e.type === "ghost_bride_group_chosen"),
        label = ghostBrideEventLabel(group.type, group.payload, locale)!;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(page.getByTestId("composition-event")).toHaveText(label);
      await expect(page.locator(".seat-grid .dead")).toHaveCount(0);
      const bride = group.payload.brideId;
      await expect(page.locator(`[data-composition-player="${bride}"]`)).toContainText(
        locale === "en" ? "Ghost Bride" : "鬼魂新娘",
      );
      const slider = page.getByRole("slider");
      for (let n = 0; n < 15; n++) await slider.press("ArrowRight");
      const caption = await page.getByTestId("composition-caption").boundingBox();
      expect(caption).not.toBeNull();
      for (const seat of await page.locator("[data-composition-player]").all()) {
        const box = await seat.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThan(caption!.y);
      }
      if (kind === "pair")
        await page.screenshot({
          path: `/tmp/awa-p9-ghost-bride-${locale}-browser.png`,
          fullPage: true,
        });
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .winner")).toHaveCount(kind === "good" ? 8 : 3);
      await expect(page.getByTestId("composition-winner")).toHaveCount(kind === "good" ? 8 : 3);
      if (kind === "witness") {
        await expect(page.locator(`[data-composition-player="${bride}"]`)).toHaveAttribute(
          "data-testid",
          "composition-winner",
        );
        await expect(
          page.locator(`[data-composition-player="${group.payload.groomId}"]`),
        ).toHaveAttribute("data-testid", "composition-winner");
      }
      if (kind === "pair")
        await page.screenshot({
          path: `/tmp/awa-p9-ghost-bride-${locale}-terminal-browser.png`,
          fullPage: true,
        });
    });
for (const actor of ["bride", "groom", "witness", "pack"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${actor}/${locale}: strict actual private marriage archive becomes a minimal shared frame without other identities`, async ({
      page,
    }) => {
      const god = read("ghost-bride-pair.replay.json"),
        view = readReplayPlayerView(read(`player-views/ghost-bride-pair-${actor}.player.json`));
      const entries = view.timeline.filter((r) => r.kind === "event");
      if (actor === "pack")
        expect(
          entries.some((r) => r.kind === "event" && r.event.type.startsWith("ghost_bride_")),
        ).toBe(false);
      if (actor === "witness")
        expect(
          entries.some(
            (r) =>
              r.kind === "event" &&
              ["ghost_bride_partner_chat", "ghost_bride_witness_vote"].includes(r.event.type),
          ),
        ).toBe(false);
      const own = entries.find(
        (r) =>
          r.kind === "event" &&
          r.event.type === (actor === "pack" ? "wolf_kill_vote_cast" : "ghost_bride_group_chosen"),
      );
      if (!own || own.kind !== "event") throw new Error("missing_authorized_fact");
      const event = {
        seq: 2,
        timestamp: own.timestamp!,
        phase: own.phase,
        day: own.day,
        type: own.event.type,
        payload: own.event.payload,
      };
      const replay = {
        ...god,
        meta: { ...god.meta, locale },
        players: god.players.map((p: any) => ({
          ...p,
          role: p.player_id === view.player_id ? view.role : "unknown",
          camp: p.player_id === view.player_id ? view.camp : "unknown",
        })),
        events: [
          {
            seq: 1,
            timestamp: event.timestamp,
            phase: "night",
            day: 1,
            type: "phase_changed",
            payload: { phase: "night", day: 1 },
          },
          event,
        ],
      };
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const label = eventLabel(
        event,
        locale,
        god.players.map((p: any) => p.player_id),
      );
      await page.locator(".timeline .event").filter({ hasText: label }).click();
      await expect(page.getByTestId("composition-event")).toHaveText(label);
      for (const p of replay.players.filter((p: any) => p.player_id !== view.player_id))
        await expect(page.locator(`[data-composition-player="${p.player_id}"]`)).toContainText(
          "unknown",
        );
    });

for (const kind of ["night-win", "all-dead"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${kind}/${locale}: actual terminal Night browser shows exactly checkpoint deaths and winners`, async ({
      page,
    }) => {
      const replay = read(`ghost-bride-${kind}.replay.json`),
        cp = read(`checkpoints/ghost-bride-${kind}.json`);
      replay.meta.locale = locale;
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await page.locator(".timeline .event").last().click();
      await expect(page.locator(".seat-grid .dead")).toHaveCount(
        cp.players.filter((p: any) => !p.alive).length,
      );
      await expect(page.locator(".seat-grid .winner")).toHaveCount(kind === "all-dead" ? 0 : 3);
      await expect(page.getByTestId("composition-winner")).toHaveCount(kind === "all-dead" ? 0 : 3);
      if (kind === "all-dead")
        await page.screenshot({
          path: `/tmp/awa-p9-ghost-bride-${locale}-draw-browser.png`,
          fullPage: true,
        });
    });
