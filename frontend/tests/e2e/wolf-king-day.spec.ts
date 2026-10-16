/**
 * 浏览器集成测试负责跳转并倒看狼王白天开枪归档，覆盖原目标／换位目标、夜间／放逐来源和两语。
 * 输入为原事件及 checkpoint；输出按原席位预期核对各枪击帧和胜者时点，不执行死亡 hook 或更换录制政策。
 */
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../src/replay/event-labels";

for (const mapping of ["original", "exchanged"] as const)
  for (const origin of ["night", "exile"] as const)
    for (const locale of ["zh-CN", "en"] as const)
      test(`Wolf King configured day gun, frame and rewind/${mapping}/${origin}/${locale}`, async ({
        page,
      }) => {
        const base = "frontend/tests/fixtures/day-king-" + mapping + "-" + origin + "-" + locale;
        const replay = readReplayDocument(
          JSON.parse(readFileSync(frontendFixtureURL(base + ".replay.json"), "utf8")),
        );
        const checkpoint = JSON.parse(
          readFileSync(frontendFixtureURL(base + ".checkpoint.txt"), "utf8"),
        ) as {
          players: Array<{ id: number; role: string; alive: boolean }>;
        };
        const king = checkpoint.players.find((p) => p.role === "wolf_king")!.id;
        const hunter = checkpoint.players.find((p) => p.role === "hunter")!.id;
        await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
        await page.goto("/");
        const exchange = replay.events.find((e) => e.type === "magician_exchange_committed")!;
        const select = async (event: typeof exchange) => {
          const label = eventLabel(
            event,
            locale,
            replay.players.map((p: { player_id: number }) => p.player_id),
            replay.players.map((p: { player_id: number; name?: string }) => ({
              id: p.player_id,
              name: p.name,
            })),
          );
          await page.locator(".timeline .event").filter({ hasText: label }).first().click();
          await expect(page.getByTestId("composition-event")).toHaveText(label);
        };
        const deadIds = async () =>
          (await page.locator(".seat-grid .dead .seat-number").allTextContents()).map(Number);
        await select(exchange);
        expect(await deadIds()).toEqual([]);
        if (origin === "exile") {
          const exile = replay.events.find(
            (e) => e.type === "voted_out" && e.payload.target === king,
          )!;
          await select(exile);
          expect(await deadIds()).toContain(king);
          expect(await deadIds()).not.toContain(hunter);
          const shot = replay.events.find((e) => e.type === "wolf_king_shot")!;
          await select(shot);
          expect(await deadIds()).toContain(hunter);
          await select(exile);
          expect(await deadIds()).not.toContain(hunter);
        } else {
          expect(
            replay.events.some((e) => e.type === "wolf_king_shot" || e.type === "hunter_shot"),
          ).toBe(false);
          const night = replay.events.find(
            (e) =>
              e.type === "night_resolved" &&
              Array.isArray(e.payload.deaths) &&
              e.payload.deaths.includes(king),
          )!;
          await select(night);
          expect(await deadIds()).toContain(king);
          expect(await deadIds()).not.toContain(hunter);
        }
        await select(exchange);
        expect(await deadIds()).toEqual([]);
        await expect(page.getByTestId("composition-winner")).toHaveCount(0);
        await page.locator(".timeline .event").last().click();
        expect(await deadIds()).toEqual(
          checkpoint.players.filter((p) => !p.alive).map((p) => p.id),
        );
        await expect(page.getByTestId("composition-winner")).not.toHaveCount(0);
        await page.reload();
        await page.locator(".timeline .event").last().click();
        expect(await deadIds()).toEqual(
          checkpoint.players.filter((p) => !p.alive).map((p) => p.id),
        );
      });
