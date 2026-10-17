/**
 * 负责动物梦境复盘的双语浏览器集成测试。输入为既有公开／玩家 fixture，断言逐帧席位、反向跳转和私有字段缺席。
 * 画面对照使用共用纯帧视图，不是独立规则 oracle；浏览器路由只提供本地样本，不启动真实模型或重新执行对局。
 */
import { replayBrowserFrame } from "../support/replay-browser-frame";
import { test, expect } from "@playwright/test";
import { text } from "@ai-werewolf-arena/game-text";
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
      // 先按正序跳到关键边界，再逆跳三个边界，验证当前画面不依赖此前播放路径。
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
          if (p.playerId !== own && !p.publicRole)
            await expect(page.locator(`[data-composition-player="${p.playerId}"]`)).toContainText(
              text(locale, "replay.unknown"),
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
