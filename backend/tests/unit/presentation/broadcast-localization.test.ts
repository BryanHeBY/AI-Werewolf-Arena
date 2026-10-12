/**
 * Unit tests: Broadcast localization uses literal game, potion, role and vote events;
 * handwritten rendered captions check localized labels while preserving raw game facts.
 * Inputs and expected outcomes remain the original literal or immutable-fixture oracle;
 * these module assertions invoke no model or complete-game driver.
 */
import { Camp, Phase, PotionType } from "../../../src/core/domain/identity";
import { fixtureResult } from "../../support/fixture_values";
import { getDefaultScriptEventRenderRegistry } from "../../../src/game/mechanisms";
import { GameEvent } from "../../../src/core/domain/model";

describe("broadcast localization", () => {
  test("game_over should render localized winner/reason in the live observation channel", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "game_over",
      payload: fixtureResult(Camp.Wolf, "wolves_reach_half"),
    };

    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(live.some((item) => item.text.includes("狼人阵营胜利"))).toBe(true);
    expect(live.some((item) => item.text.includes("狼人达半"))).toBe(true);
  });

  test("witch_potion_used should render localized potion text", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "witch_potion_used",
      payload: {
        actorId: 7,
        targetId: 3,
        potionType: PotionType.Heal,
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
        boardSize: 3,
        players: [
          { id: 1, seat: 1, name: "Player 1", camp: Camp.Wolf, role: "wolf" },
          { id: 2, seat: 2, name: "Player 2", camp: Camp.Good, role: "seer" },
          { id: 3, seat: 3, name: "Player 3", camp: Camp.Good, role: "villager" },
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
        phase: Phase.GameOver,
        day: 2,
        winner: Camp.Wolf,
        reason: "wolves_reach_half",
      },
    };

    const judge = getDefaultScriptEventRenderRegistry().toJudgeLine(event);
    expect(judge).toContain("对局结束");
    expect(judge).toContain("胜利阵营：狼人");
    expect(judge).toContain("原因：狼人达半");

    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(
      live.some((item) =>
        item.text.includes("[live][上帝] 对局结束，胜利阵营：狼人，原因：狼人达半"),
      ),
    ).toBe(true);
  });

  test("wolf_tactical_order should render as god guidance line", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "wolf_tactical_order",
      audience: [5, 3],
      payload: {
        order: [5, 3],
      },
    };
    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(
      live.some((item) => item.text.includes("[live][上帝] 狼人开始夜聊讨论，顺序：5->3")),
    ).toBe(true);
  });

  test("last_words_spoken should render dedicated last-words channel line", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "last_words_spoken",
      payload: {
        playerId: 6,
        phase: Phase.Voting,
        day: 1,
        text: "我是预言家，昨晚验1金水。",
      },
    };
    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(live.some((item) => item.text.includes("[live][遗言][6] 我是预言家"))).toBe(true);
  });

  test("sheriff summary should use god channel instead of action channel", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "sheriff_vote_summary",
      payload: {
        votes: [
          { actorId: 1, targetId: 2, abstain: false },
          { actorId: 2, targetId: null, abstain: true },
        ],
        winnerId: 2,
      },
    };
    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(live.some((item) => item.text.includes("[live][上帝][警长投票]"))).toBe(true);
  });

  test("sheriff_vote_cast should render per-action live line", () => {
    const event: GameEvent = {
      timestamp: Date.now(),
      type: "sheriff_vote_cast",
      payload: {
        actorId: 3,
        targetId: 1,
        abstain: false,
      },
    };
    const live = getDefaultScriptEventRenderRegistry().toLiveRender(event, true);
    expect(live.some((item) => item.text.includes("[live][行动][警长投票] 3号投给1号"))).toBe(true);
  });
});
