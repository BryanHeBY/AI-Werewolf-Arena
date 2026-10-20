/**
 * 浏览器集成测试验证光蚀各角色真实玩家档构成的最小画面。输入为已授权事件、两语和帧号；
 * 输出按原无胜者／零死亡及未知他人身份的字面预期核对跳转和倒看，字幕与现行展示函数对照，不引入 God 私有知识。
 */
import { currentEventSourceText } from "../support/replay-current-event";
import { replayBrowserFrame } from "../support/replay-browser-frame";
import { frontendFixtureURL } from "../support/fixtures/manifest";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { createReplayRenderInput } from "../../src/replay/replay-frame";
import { eventLabel } from "../../src/replay/event-labels";
import { roleName } from "../../src/replay/replay-localization";
import { text } from "@ai-werewolf-arena/game-text";
for (const actor of ["maid", "count", "witch", "pack", "villager"] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Radiant actual owner minimal movie input and rewind/${actor}/${locale}`, async ({
      page,
    }) => {
      const name = `radiant-independent-stock-card16-card17-${locale}`;
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
      // 用真实已授权归档构造最小渲染契约；这不是 UI 直接导入私有文件。
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
        actor === "maid"
          ? "eclipse_swallowed"
          : actor === "count"
            ? "radiant_shelter_chosen"
            : actor === "witch"
              ? "eclipse_native_suppressed"
              : "night_resolved";
      const event = replay.events.find((e) => e.type === type && e.day === 2)!;
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
      await expect(currentEventSourceText(page)).toHaveText(label);
      for (const p of replay.players) {
        await expect(page.locator(`[data-composition-player="${p.player_id}"]`)).toContainText(
          p.player_id === view.player_id
            ? roleName(view.role, locale)
            : text(locale, "replay.unknown"),
        );
      }
      if (actor !== "maid")
        expect(replay.events.some((e) => e.type === "eclipse_swallowed")).toBe(false);
      expect(replay.events.some((e) => e.type === "eclipse_lease_closed")).toBe(false);
      const index = input.replay.events.findIndex((e) => e.seq === event.seq);
      const slider = page.locator('.frame-control input[type="range"]');
      for (const frame of [index * 90 + 45, index * 90 - 1, 0]) {
        await slider.evaluate(
          (el, value) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
              el,
              String(value),
            );
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          },
          replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" }),
        );
        await expect(slider).toHaveValue(
          String(replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" })),
        );
        await expect(page.getByTestId("composition-event")).toHaveAttribute(
          "data-event-seq",
          String(input.replay.events[Math.floor(frame / 90)]!.seq),
        );
        await expect(page.getByTestId("composition-winner")).toHaveCount(0);
      }
      expect(await page.locator(".seat-grid .dead .seat-number").allTextContents()).toEqual([]);
    });
