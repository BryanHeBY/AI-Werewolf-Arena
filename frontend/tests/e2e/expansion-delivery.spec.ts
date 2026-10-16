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
        await expect(page.getByTestId("composition-event")).toHaveAttribute(
          "data-event-seq",
          String(state.eventSeq),
        );
        await expect(page.getByTestId("composition-event")).not.toContainText('{"policy"');
        for (const p of state.players)
          await expect(page.locator(`[data-composition-player="${p.playerId}"]`)).toHaveCSS(
            "opacity",
            p.alive ? "1" : p.isWinner ? "0.75" : "0.35",
          );
      }
      if (["awakened-witch", "warden", "awakened-dark-stars", "awakened-knight"].includes(feature))
        await page.screenshot({
          path: info.outputPath(`${feature}-${locale}.png`),
          fullPage: true,
        });
    });
