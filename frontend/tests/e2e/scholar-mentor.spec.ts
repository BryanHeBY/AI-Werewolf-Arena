/**
 * Browser integration tests render recorded Scholar Mentor bonus and conflict
 * fixtures in both locales. Archive events and literal frame assertions check
 * that bonuses preserve seats and same-good or both-wolf conflicts stay pending
 * until dawn. These tests play settled inputs without choosing a mentor.
 */
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const locale of ["zh-CN", "en"] as const)
  test("Scholar Mentor bonuses do not announce deaths early/" + locale, async ({ page }) => {
    const base = "frontend/tests/fixtures/scholar-mentor-" + locale;
    const replay = readReplayDocument(
      JSON.parse(readFileSync(frontendFixtureURL(base + ".replay.json"), "utf8")),
    );
    const cp = JSON.parse(
      readFileSync(frontendFixtureURL(base + ".checkpoint.txt"), "utf8"),
    ) as { players: Array<{ id: number; role: string; alive: boolean }> };
    await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
    await page.goto("/");
    const dead = async () =>
      (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number);
    const show = async (e: (typeof replay.events)[number]) => {
      const label = eventLabel(e, locale);
      await page.locator(".timeline .event").filter({ hasText: label }).first().click();
      await expect(page.getByTestId("composition-event")).toHaveText(label);
    };
    const skipped = replay.events.find((e) => e.type === "modifier_choice_skipped")!;
    await show(skipped);
    expect(await dead()).toEqual([]);
    const choices = replay.events.filter(
      (e) => e.type === "modifier_choice_committed" && e.day === 2,
    );
    expect(choices).toHaveLength(2);
    for (const e of choices) {
      await show(e);
      expect(await dead()).toHaveLength(3);
    }
    const bonuses = replay.events.filter((e) => e.type === "modifier_bonus_resolved");
    expect(bonuses).toHaveLength(2);
    for (const e of bonuses) {
      await show(e);
      expect(await dead()).toHaveLength(3);
    }
    const kill = bonuses.find((e) => e.payload.kind === "kill")!;
    expect(await dead()).not.toContain(kill.payload.targetId);
    await show(replay.events.find((e) => e.type === "night_resolved" && e.day === 2)!);
    expect(await dead()).toContain(kill.payload.targetId);
    expect(await dead()).toHaveLength(4);
    await page.locator(".timeline .event").last().click();
    expect(await dead()).toEqual(cp.players.filter((p) => !p.alive).map((p) => p.id));
    await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
    await show(choices[0]!);
    expect(await dead()).toHaveLength(3);
    await show(skipped);
    expect(await dead()).toEqual([]);
    await page.reload();
    await show(bonuses[0]!);
    expect(await dead()).toHaveLength(3);
  });

for (const variant of ["same-good", "both-wolves"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(
      "Scholar Mentor conflict remains pending until dawn/" + variant + "/" + locale,
      async ({ page }) => {
        const base = "frontend/tests/fixtures/scholar-mentor-" + variant + "-" + locale;
        const replay = readReplayDocument(
          JSON.parse(readFileSync(frontendFixtureURL(base + ".replay.json"), "utf8")),
        );
        const cp = JSON.parse(
          readFileSync(frontendFixtureURL(base + ".checkpoint.txt"), "utf8"),
        ) as { players: Array<{ id: number; role: string; alive: boolean }> };
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        const dead = async () =>
          (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number);
        const show = async (e: (typeof replay.events)[number]) => {
          const label = eventLabel(e, locale);
          await page.locator(".timeline .event").filter({ hasText: label }).first().click();
          await expect(page.getByTestId("composition-event")).toHaveText(label);
        };
        const conflict = replay.events.find((e) => e.type === "modifier_conflict_resolved")!;
        expect(conflict).toBeDefined();
        await show(conflict);
        expect(await dead()).not.toContain(conflict.payload.targetId);
        expect(await dead()).toHaveLength(variant === "same-good" ? 3 : 2);
        await show(replay.events.find((e) => e.type === "seer_checked" && e.day === 2)!);
        expect(await dead()).not.toContain(conflict.payload.targetId);
        await show(replay.events.find((e) => e.type === "night_resolved" && e.day === 2)!);
        expect(await dead()).toContain(conflict.payload.targetId);
        expect(await dead()).toHaveLength(variant === "same-good" ? 4 : 3);
        await page.locator(".timeline .event").last().click();
        expect(await dead()).toEqual(cp.players.filter((p) => !p.alive).map((p) => p.id));
        await show(conflict);
        expect(await dead()).not.toContain(conflict.payload.targetId);
      },
    );
