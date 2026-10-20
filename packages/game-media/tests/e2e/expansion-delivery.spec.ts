/**
 * 浏览器集成测试负责已交付扩展的实际教学God档加载、自然文案、席位帧与逆向跳转。
 * 输入是公开两语真实归档；逐帧视图作UI接线对照，角色规则另由独立引擎判例核验。
 * 本测试不执行模型或读取个人记录；God档含隐藏身份，不能当玩家授权导出。
 */
import { replayBrowserFrame } from "../support/replay-browser-frame";
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { createReplayRenderInput, buildReplayFrame } from "../../src/replay/replay-frame";
import { playerLabel } from "@ai-werewolf-arena/game-presentation";
const features = [
  ["crow", ["crow_curse_"]],
  ["silence-elder", ["silence_"]],
  ["warden", ["warden_"]],
  ["awakened-wolf-king", ["awakened_claw"]],
  ["awakened-witch", ["awakened_brew_", "brew_"]],
  ["awakened-dark-stars", ["awakened_charm_", "awakened_beauty_", "awakened_patrol_"]],
  ["awakened-knight", ["awakened_protection_", "awakened_duel_", "awakened_beauty_"]],
] as const;
for (const [feature, prefixes] of features)
  for (const locale of ["zh-CN", "en"] as const)
    test(`Expansion delivered actual archive ${feature}/${locale}`, async ({ page }, info) => {
      const filename =
        feature === "awakened-dark-stars"
          ? `12-day_replacement-${locale}`
          : feature === "awakened-knight"
            ? `body-${locale}`
            : locale;
      const replay = readReplayDocument(
          JSON.parse(
            readFileSync(
              new URL(`../../../docs/examples/${feature}/${filename}.replay.json`, import.meta.url),
              "utf8",
            ),
          ),
        ),
        input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      await page.route("**/api/replay", (route) => route.fulfill({ json: replay }));
      await page.goto("/");
      await expect(page.locator("[data-composition-player]")).toHaveCount(replay.players.length);
      const slider = page.locator('.frame-control input[type="range"]'),
        indices = input.replay.events.flatMap((e, i) =>
          prefixes.some((p) => e.type.startsWith(p)) ||
          ["night_resolved", "voted_out", "player_shot", "hunter_shot", "game_over"].includes(
            e.type,
          )
            ? [i]
            : [],
        );
      expect(indices.length).toBeGreaterThan(0);
      for (const i of [...indices, ...[...indices].reverse().slice(0, 3)]) {
        const frame = i * 90 + 45,
          state = buildReplayFrame(input, frame);
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
        const sourceEvent = input.replay.events[i]!;
        // 乌鸦增票与紧邻票型共段揭晓；游标指汇总，但修正目标和权重仍按原事件逐项核验。
        const summary =
          sourceEvent.type === "crow_curse_applied"
            ? replay.events.find(
                (event) =>
                  event.seq > sourceEvent.seq &&
                  event.type === "vote_summary" &&
                  event.day === sourceEvent.day &&
                  event.phase === sourceEvent.phase,
              )
            : undefined;
        await expect(page.getByTestId("composition-event")).toHaveAttribute(
          "data-event-seq",
          String(summary?.seq ?? state.eventSeq),
        );
        if (summary) {
          const targetId = Number(sourceEvent.payload.targetId);
          const target = replay.players.find((player) => player.player_id === targetId)!;
          await expect(page.locator(`[data-event-seq="${sourceEvent.seq}"].event`)).toHaveCount(1);
          // 票图按座次标注增票；姓名属于名册资料，不重复拼入票型目标。
          await expect(page.locator("[data-scene-ballot]")).toContainText(
            `${playerLabel({ id: targetId, seat: target.seat }, locale)} +${sourceEvent.payload.bonus}`,
          );
        }
        await expect(page.locator(".current-event > p")).not.toContainText('{"policy"');
        await expect(page.locator("[data-video-stage]")).not.toContainText('{"policy"');
        for (const p of state.players)
          await expect(page.locator(`[data-composition-player="${p.playerId}"]`)).toHaveAttribute(
            "data-player-alive",
            String(p.alive),
          );
      }
      if (["awakened-witch", "warden", "awakened-dark-stars", "awakened-knight"].includes(feature))
        await page.screenshot({
          path: info.outputPath(`${feature}-${locale}.png`),
          fullPage: true,
        });
    });
