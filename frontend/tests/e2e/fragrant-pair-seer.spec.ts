/**
 * 负责馥郁双生复盘的双语浏览器集成测试。输入为既有公开／玩家 fixture，断言关键帧席位、反向跳转与私有事实裁剪。
 * 画面对照来自共用纯帧视图，不替代独立领域核验；只路由本地归档样本，不调用模型或重新运行游戏。
 */
import { replayBrowserFrame } from "../support/replay-browser-frame";
import { test, expect } from "@playwright/test";
import { text } from "@ai-werewolf-arena/game-text";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { fragrantNames, loadFragrant, fragrantPrivateReplay } from "../support/fragrant-replay";
import { createReplayRenderInput, buildReplayFrame } from "../../src/replay/replay-frame";
for (const locale of ["zh-CN", "en"] as const)
  for (const name of fragrantNames)
    test(`Fragrant public boundaries and reverse seek ${name}/${locale}`, async ({ page }) => {
      const replay = readReplayDocument(loadFragrant(`fragrant-${name}-${locale}`, ".replay.json")),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      const slider = page.locator('.frame-control input[type="range"]');
      const indices = input.replay.events.flatMap((e, i) =>
        e.type.startsWith("fragrant_") ||
        ["night_resolved", "additional_deaths", "hunter_shot", "game_over"].includes(e.type)
          ? [i]
          : [],
      );
      // 逆跳复用相同目标帧，检查投影不会累积上次播放到的状态。
      for (const i of [...indices, ...[...indices].reverse().slice(0, 3)]) {
        const frame = i * 90 + 45;
        await slider.evaluate(
          (el, frame) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
              el,
              String(frame),
            );
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          },
          replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" }),
        );
        for (const p of buildReplayFrame(input, frame).players)
          await expect(page.locator(`[data-composition-player="${p.playerId}"]`)).toHaveAttribute(
            "data-player-alive",
            String(p.alive),
          );
      }
    });
for (const locale of ["zh-CN", "en"] as const)
  for (const owner of ["phantom", "seer", "villager", "pack"] as const)
    test(`Fragrant private masking ${owner}/${locale}`, async ({ page }) => {
      const replay = fragrantPrivateReplay(`fragrant-expiry-${locale}`, owner);
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await expect(page.locator("[data-composition-player]")).toHaveCount(12);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        own = replay.players.find((p) => p.role !== "unknown")!.player_id,
        idx = input.replay.events.findIndex(
          (e) => e.type.startsWith("fragrant_") || e.type === "night_resolved",
        ),
        slider = page.locator('.frame-control input[type="range"]');
      for (const frame of [idx * 90 + 45, Math.max(0, idx * 90 - 1), 0]) {
        await slider.evaluate(
          (el, frame) => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
              el,
              String(frame),
            );
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          },
          replayBrowserFrame(replay, frame, { locale, timeZone: "UTC" }),
        );
        const state = buildReplayFrame(input, frame);
        await expect(page.getByTestId("composition-event")).toHaveAttribute(
          "data-event-seq",
          String(state.eventSeq),
        );
        for (const p of state.players)
          if (p.playerId !== own)
            await expect(page.locator(`[data-composition-player="${p.playerId}"]`)).toContainText(
              text(locale, "replay.unknown"),
            );
      }
      expect(
        replay.events.some((e) =>
          [
            "fragrant_night_opened",
            "fragrant_wave_committed",
            "fragrant_link_triggered",
            "fragrant_binding_expired",
          ].includes(e.type),
        ),
      ).toBe(false);
    });
