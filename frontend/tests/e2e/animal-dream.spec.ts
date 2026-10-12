import { test, expect } from "@playwright/test";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { animalNames, loadAnimal, animalPrivateReplay } from "../support/animal-replay";
import { createReplayRenderInput, buildReplayFrame } from "../../src/replay/replay-frame";
for (const locale of ["zh-CN", "en"] as const)
  for (const name of animalNames)
    test(`Animal public boundaries and reverse seek ${name}/${locale}`, async ({ page }) => {
      const replay = readReplayDocument(
          loadAnimal(`animal-${name}-wait-final-${locale}`, ".replay.json"),
        ),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const slider = page.locator('.frame-control input[type="range"]');
      const indices = input.replay.events.flatMap((e, i) =>
        e.type.startsWith("animal_") ||
        ["night_resolved", "additional_deaths", "hunter_shot", "game_over"].includes(e.type)
          ? [i]
          : [],
      );
      for (const i of [...indices, ...[...indices].reverse().slice(0, 3)]) {
        const frame = i * 90 + 45;
        await slider.evaluate((el, frame) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            el,
            String(frame),
          );
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, frame);
        for (const p of buildReplayFrame(input, frame).players)
          await expect(page.locator(`[data-composition-player="${p.playerId}"]`)).toHaveCSS(
            "opacity",
            p.alive ? "1" : p.isWinner ? "0.75" : "0.35",
          );
      }
    });
for (const locale of ["zh-CN", "en"] as const)
  for (const owner of ["fox", "cat", "puffer", "villager"] as const)
    test(`Animal private masking ${owner}/${locale}`, async ({ page }) => {
      const replay = animalPrivateReplay(`animal-cat_badge-wait-final-${locale}`, owner);
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await expect(page.locator("[data-composition-player]")).toHaveCount(12);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        own = replay.players.find((p) => p.role !== "unknown")!.player_id,
        idx = input.replay.events.findIndex(
          (e) => e.type.startsWith("animal_") || e.type === "night_resolved",
        ),
        slider = page.locator('.frame-control input[type="range"]');
      for (const frame of [idx * 90 + 45, Math.max(0, idx * 90 - 1), 0]) {
        await slider.evaluate((el, frame) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            el,
            String(frame),
          );
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, frame);
        const state = buildReplayFrame(input, frame);
        await expect(page.getByTestId("composition-event")).toHaveAttribute(
          "data-event-seq",
          String(state.eventSeq),
        );
        for (const p of state.players)
          if (p.playerId !== own && !p.publicRole)
            await expect(page.locator(`[data-composition-player="${p.playerId}"]`)).toContainText(
              "unknown",
            );
      }
      expect(
        replay.events.some((e) =>
          [
            "animal_night_opened",
            "animal_wave_committed",
            "animal_fox_effect",
            "animal_puffer_targets",
          ].includes(e.type),
        ),
      ).toBe(false);
    });
