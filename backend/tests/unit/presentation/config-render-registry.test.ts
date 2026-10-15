/**
 * 单元测试以显式胜利、身份及机制开关为输入，用精确规则摘要和关闭选举时不显示相应说明的断言核对公开提示 registry。预期仍为原字面值或不可变夹具；不调用模型或完整对局驱动。
 */
import { DefaultConfigRenderRegistry } from "../../../src/agents/prompt/config-render-registry";
import { ActionWindow, BoardConfig, WinCondition } from "../../../src/domain/model";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

describe("ConfigRenderRegistry", () => {
  test("renders rule summary with win condition and core mechanism toggles", () => {
    const registry = new DefaultConfigRenderRegistry();
    const prompt = registry.renderBoardConfigPrompt(sixPlayerMvpConfig);

    expect(prompt).toContain("本局规则配置：");
    expect(prompt).toContain("胜利条件：");
    expect(prompt).toContain("警长机制：");
    expect(prompt).toContain("自爆机制：");
  });

  test("does not render election flow guidance when sheriff is disabled", () => {
    const registry = new DefaultConfigRenderRegistry();
    const prompt = registry.renderBoardConfigPrompt(sixPlayerMvpConfig);

    expect(prompt).toContain("警长机制：未启用");
    expect(prompt).not.toContain("上警、竞选发言、退水、警下投票");
    expect(prompt).not.toContain("首日特殊时序");
  });

  test("renders multiple win conditions in configured order", () => {
    const registry = new DefaultConfigRenderRegistry();
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      winConditions: [WinCondition.WolfReachHalf, WinCondition.SlaughterCity],
    };

    const prompt = registry.renderBoardConfigPrompt(config);
    const line = prompt.split("\n").find((item) => item.startsWith("胜利条件：")) ?? "";

    const halfIndex = line.indexOf("狼人达半");
    const cityIndex = line.indexOf("屠城");
    expect(halfIndex).toBeGreaterThan(-1);
    expect(cityIndex).toBeGreaterThan(-1);
    expect(halfIndex).toBeLessThan(cityIndex);
  });

  test("renders default rule text when optional settings are missing", () => {
    const registry = new DefaultConfigRenderRegistry();
    const config: BoardConfig = {
      boardSize: 6,
      roleSetups: [...sixPlayerMvpConfig.roleSetups],
      hooks: {
        onDaybreak: false,
        onPreElection: false,
        onPreVote: false,
        onPerSpeechGap: false,
      },
      enableSheriff: false,
      winCondition: undefined,
      winConditions: undefined,
      tieBreaker: undefined,
      selfDestruct: {
        enabledWindows: [ActionWindow.OnPreVote],
      },
    };

    const prompt = registry.renderBoardConfigPrompt(config);

    expect(prompt).toContain("胜利条件：屠城");
    expect(prompt).toContain("平票处理：放逐=最低编号者，狼刀=最低编号者");
  });

  test("explains the first-day sheriff flow before night results are announced", () => {
    const registry = new DefaultConfigRenderRegistry();
    const prompt = registry.renderBoardConfigPrompt({
      ...sixPlayerMvpConfig,
      enableSheriff: true,
    });

    expect(prompt).toContain("首日特殊时序");
    expect(prompt).toContain("警长投票结束后，才由 night_resolved 公布昨夜死亡或平安夜");
    expect(prompt).toContain("昨夜实际死亡的玩家在公开结算前仍会参与上警流程");
    expect(prompt).toContain("普通夜间死亡和放逐出局均不公开底牌");
    expect(prompt).toContain("首夜死亡者、真正被放逐出局者、白天纯决斗失误的骑士获得遗言");
    expect(prompt).toContain("决斗成功目标与白狼王带走的目标均无遗言");
    expect(prompt).toContain("不提供原警长自行选择移交目标");
  });
});
