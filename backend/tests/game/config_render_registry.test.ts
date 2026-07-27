import { DefaultConfigRenderRegistry } from "../../src/game/mechanisms/prompt/config_render_registry";
import { ActionWindow, BoardConfig, WinCondition } from "../../src/core/domain/model";
import { sixPlayerMvpConfig } from "../../src/runtime/scenarios/six_player_mvp";

describe("ConfigRenderRegistry", () => {
  test("PA01: should render rule summary with win condition and core mechanism toggles", () => {
    const registry = new DefaultConfigRenderRegistry();
    const prompt = registry.renderBoardConfigPrompt(sixPlayerMvpConfig);

    expect(prompt).toContain("本局规则配置：");
    expect(prompt).toContain("胜利条件：");
    expect(prompt).toContain("警长机制：");
    expect(prompt).toContain("自爆机制：");
  });

  test("PA02: sheriff disabled board should not render election flow guidance", () => {
    const registry = new DefaultConfigRenderRegistry();
    const prompt = registry.renderBoardConfigPrompt(sixPlayerMvpConfig);

    expect(prompt).toContain("警长机制：未启用");
    expect(prompt).not.toContain("上警、竞选发言、退水、警下投票");
  });

  test("PA03: multi win conditions should render in configured order", () => {
    const registry = new DefaultConfigRenderRegistry();
    const config: BoardConfig = {
      ...sixPlayerMvpConfig,
      winConditions: [WinCondition.WolfReachHalf, WinCondition.SlaughterCity],
    };

    const prompt = registry.renderBoardConfigPrompt(config);
    const line = prompt
      .split("\n")
      .find((item) => item.startsWith("胜利条件：")) ?? "";

    const halfIndex = line.indexOf("狼人达半");
    const cityIndex = line.indexOf("屠城");
    expect(halfIndex).toBeGreaterThan(-1);
    expect(cityIndex).toBeGreaterThan(-1);
    expect(halfIndex).toBeLessThan(cityIndex);
  });

  test("PA04: when optional settings are missing, prompt should render default rule text", () => {
    const registry = new DefaultConfigRenderRegistry();
    const config: BoardConfig = {
      boardSize: 6,
      roleSetups: [...sixPlayerMvpConfig.roleSetups],
      revealOnDeath: false,
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
    expect(prompt).toContain("平票处理：放逐=min_id，狼刀=min_id");
  });
});
