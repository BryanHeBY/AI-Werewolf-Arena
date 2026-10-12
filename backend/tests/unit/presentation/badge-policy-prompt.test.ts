/**
 * Unit tests: Badge prompt rendering uses explicit holder-choice/automatic policies and
 * disabled sheriffs; literal bilingual rule text checks that exactly the declared badge
 * guidance is shown. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { expect, test } from "bun:test";
import { DefaultConfigRenderRegistry } from "../../../src/game/mechanisms/prompt/config_render_registry";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
for (const locale of ["en", "zh-CN"] as const)
  for (const choice of [false, true])
    test(`one accurate badge rule ${locale}/${choice ? "holder" : "automatic"}`, () => {
      const prompt = new DefaultConfigRenderRegistry().renderBoardConfigPrompt(
        {
          ...sixPlayerMvpConfig,
          enableSheriff: true,
          sheriff: { badgePolicy: choice ? "awa_holder_choice_v1" : "awa_next_seat_v1" },
        },
        locale,
      );
      const badge = prompt
        .split("\n")
        .filter((line) => line.startsWith(locale === "en" ? "Badge:" : "警徽："));
      expect(badge).toEqual([
        locale === "en"
          ? choice
            ? "Badge: the deceased holder chooses an eligible living successor or destroys it; revealed Idiots destroy it directly."
            : "Badge: transfer automatically by living seat order after death; revealed Village Idiots destroy it directly. The former sheriff has no action to choose a recipient."
          : choice
            ? "警徽：死亡持有者选择合格活人继任或撕毁；白痴翻牌直接撕毁。"
            : "警徽：出局后按存活座位顺序自动移交；白痴翻牌直接撕毁。不提供原警长自行选择移交目标的行动。",
      ]);
      expect(prompt).not.toContain(locale === "en" ? "Badge handling:" : "警徽流转：");
    });
for (const locale of ["en", "zh-CN"] as const)
  test(`disabled sheriff has no badge policy ${locale}`, () => {
    const prompt = new DefaultConfigRenderRegistry().renderBoardConfigPrompt(
      sixPlayerMvpConfig,
      locale,
    );
    expect(prompt).not.toContain(locale === "en" ? "Badge:" : "警徽：");
  });
