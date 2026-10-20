/**
 * 单元测试以显式 holder-choice／automatic 政策和关闭警长的输入，用双语字面规则文本核对只显示已声明的警徽指引。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { expect, test } from "bun:test";
import { DefaultConfigRenderRegistry } from "../../../src/agents/prompt/config-render-registry";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
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
