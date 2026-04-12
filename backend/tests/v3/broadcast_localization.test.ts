import {
  getDefaultAgentEventLineRegistry,
  getDefaultScriptEventRenderRegistry,
} from "../../src/mechanisms";
import { GameEvent } from "../../src/domain/model";

describe("broadcast localization", () => {
  test("game_over should render localized winner/reason in agent and live channels", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "game_over",
      payload: {
        winner: "wolf",
        reason: "wolves_reach_half",
      },
    };

    const agentLine = getDefaultAgentEventLineRegistry().toLine(event, {
      actorId: 1,
      isWolf: false,
    });
    expect(agentLine).toContain("胜利阵营：狼人");
    expect(agentLine).toContain("原因：狼人达半");

    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(live.some((item) => item.text.includes("胜利阵营=狼人"))).toBe(true);
    expect(live.some((item) => item.text.includes("原因=狼人达半"))).toBe(true);
  });

  test("witch_potion_used should render localized potion text", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "witch_potion_used",
      payload: {
        actorId: 7,
        targetId: 3,
        potionType: "heal",
      },
    };

    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(live.some((item) => item.text.includes("使用解药"))).toBe(true);
  });

  test("god_private_game_info should render localized role names", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "god_private_game_info",
      payload: {
        players: [
          { seat: 1, role: "wolf" },
          { seat: 2, role: "seer" },
          { seat: 3, role: "villager" },
        ],
      },
    };

    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    const line = live[0]?.text ?? "";
    expect(line).toContain("1:狼人");
    expect(line).toContain("2:预言家");
    expect(line).toContain("3:平民");
  });

  test("phase_changed(game_over) should include winner/reason in judge live line", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "phase_changed",
      payload: {
        phase: "game_over",
        day: 2,
        winner: "wolf",
        reason: "wolves_reach_half",
      },
    };

    const judge = getDefaultScriptEventRenderRegistry().toJudgeLine(event);
    expect(judge).toContain("对局结束");
    expect(judge).toContain("胜利阵营：狼人");
    expect(judge).toContain("原因：狼人达半");

    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(live.some((item) => item.text.includes("[live][上帝] 对局结束，胜利阵营：狼人，原因：狼人达半"))).toBe(true);
  });
});
