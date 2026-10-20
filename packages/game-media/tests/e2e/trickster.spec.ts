/**
 * 浏览器集成测试验证诡术师映射、取消和 PK 放逐的两语归档。
 * 输入为原事件与 checkpoint；输出检查真实放逐目标、已死目标落空及终局胜者，保留字面席位预期；跳转不执行映射或计票。
 */
import { currentEventSourceText } from "../support/replay-current-event";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";
for (const variant of ["mapped", "cancel", "pk"] as const)
  for (const locale of ["zh-CN", "en"] as const)
    test(
      "Trickster actual exile and dead-target miss/" + variant + "/" + locale,
      async ({ page }) => {
        const base = "frontend/tests/fixtures/trickster-" + variant + "-" + locale;
        const replay = readReplayDocument(
          JSON.parse(readFileSync(frontendFixtureURL(base + ".replay.json"), "utf8")),
        );
        const cp = JSON.parse(
          readFileSync(frontendFixtureURL(base + ".checkpoint.txt"), "utf8"),
        ) as { players: Array<{ id: number; role: string; alive: boolean }> };
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        const mapped = replay.events.find((e) => e.type === "exile_target_mapped")!;
        const label = eventLabel(
          mapped,
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
        expect(await dead()).toHaveLength(2);
        expect(await dead()).not.toContain(mapped.payload.effectiveId);
        const out = replay.events
          .slice(replay.events.indexOf(mapped) + 1)
          .find((e) => e.type === "voted_out")!;
        expect(out.payload.target).toBe(mapped.payload.effectiveId);
        await page
          .locator(".timeline .event")
          .filter({
            hasText: eventLabel(
              out,
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
        expect(await dead()).toContain(out.payload.target);
        const missed = replay.events.find(
          (e) => e.type === "exile_target_mapped" && e.payload.missed === true,
        )!;
        await page
          .locator(".timeline .event")
          .filter({
            hasText: eventLabel(
              missed,
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
        expect(await dead()).toContain(missed.payload.effectiveId);
        expect(await dead()).not.toContain(missed.payload.requestedId);
        await page.locator(".timeline .event").last().click();
        expect(await dead()).toEqual(cp.players.filter((p) => !p.alive).map((p) => p.id));
        expect(cp.players.find((p) => p.role === "order_prince")!.alive).toBe(true);
        await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
      },
    );
