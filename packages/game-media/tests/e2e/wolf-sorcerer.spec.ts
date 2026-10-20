/**
 * 浏览器集成测试验证狼术师重叠、取消和分离目标的两语归档。
 * 输入为原事件及 checkpoint；输出以字幕对照和字面席位预期核对身份保留、真实死亡与终局，不在测试组合目标效果。
 */
import { currentEventSourceText } from "../support/replay-current-event";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const variant of ["overlap", "cancel", "disjoint"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(
      "Wolf Sorcerer composed targets preserve identities and actual deaths/" +
        variant +
        "/" +
        locale,
      async ({ page }) => {
        const base = "frontend/tests/fixtures/wolf-sorcerer-" + variant + "-" + locale;
        const replay = readReplayDocument(
          JSON.parse(readFileSync(frontendFixtureURL(base + ".replay.json"), "utf8")),
        );
        const cp = JSON.parse(
          readFileSync(frontendFixtureURL(base + ".checkpoint.txt"), "utf8"),
        ) as { players: Array<{ id: number; role: string; alive: boolean }> };
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        const chosen = replay.events.find((e) => e.type === "wolf_sorcerer_exchange_committed")!;
        const label = eventLabel(
          chosen,
          locale,
          replay.players.map((p: { player_id: number }) => p.player_id),
          replay.players.map((p: { player_id: number; name?: string }) => ({
            id: p.player_id,
            name: p.name,
          })),
        );
        await page.locator(".timeline .event").filter({ hasText: label }).first().click();
        await expect(currentEventSourceText(page)).toHaveText(label);
        const dead = async () =>
          (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number);
        expect(await dead()).toHaveLength(3);
        const hunter = cp.players.find((p) => p.role === "hunter")!.id;
        expect(await dead()).not.toContain(hunter);
        const resolved = replay.events.find((e) => e.type === "night_resolved" && e.day === 2)!;
        await page
          .locator(".timeline .event")
          .filter({
            hasText: eventLabel(
              resolved,
              locale,
              replay.players.map((p: { player_id: number }) => p.player_id),
              replay.players.map((p: { player_id: number; name?: string }) => ({
                id: p.player_id,
                name: p.name,
              })),
            ),
          })
          .first()
          .click();
        expect(await dead()).toHaveLength(4);
        expect(await dead()).toContain(hunter);
        const shot = replay.events.find((e) => e.type === "hunter_shot")!;
        await page
          .locator(".timeline .event")
          .filter({
            hasText: eventLabel(
              shot,
              locale,
              replay.players.map((p: { player_id: number }) => p.player_id),
              replay.players.map((p: { player_id: number; name?: string }) => ({
                id: p.player_id,
                name: p.name,
              })),
            ),
          })
          .first()
          .click();
        expect(await dead()).toHaveLength(5);
        expect(await dead()).toContain(shot.payload.targetId);
        await page.locator(".timeline .event").last().click();
        expect(await dead()).toEqual(cp.players.filter((p) => !p.alive).map((p) => p.id));
        expect(cp.players.find((p) => p.role === "psychic")!.alive).toBe(true);
        expect(cp.players.find((p) => p.role === "magician")!.alive).toBe(true);
        await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
      },
    );
