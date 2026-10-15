/**
 * 单元测试验证终局候选的结构／成员／时点校验边界，不运行阶段或完整游戏。
 * 输入为手写胜利、明确 Victory 归属与可观察晚读端口；预期是字面成员和第一拒绝顺序。
 * 角色真实阵营故意与胜利归属不同；不通过被测候选算法生成预期，不更新历史归档。
 */
import { expect, test } from "bun:test";
import { Camp, Phase, Role, type WinDecision } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createRoleComponent } from "../../../src/game/observation/role-presentation";
import { createVictoryComponent } from "../../../src/domain/components/victory";
import { validateVictoryDecision } from "../../../src/game/mechanisms/win_conditions/validated-victory";

function members() {
  const world = new World(),
    first = world.createEntity(),
    second = world.createEntity();
  world.addComponent(first, COMPONENT.Role, createRoleComponent(Role.Wolf));
  world.addComponent(first, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(
    first,
    COMPONENT.Victory,
    createVictoryComponent([{ kind: "faction", faction: "good" }]),
  );
  world.addComponent(
    second,
    COMPONENT.Victory,
    createVictoryComponent([{ kind: "individual", goalId: "literal_solo" }]),
  );
  return world;
}

const decision: WinDecision = {
  winner: Camp.Good,
  reason: "raw reason\n<tag>",
  outcome: {
    kind: "victory",
    primary: { kind: "faction", faction: "good", winningPlayerIds: [1] },
    additional: [
      { kind: "individual", playerId: 2, goalId: "literal_solo", winningPlayerIds: [2] },
    ],
    winningPlayerIds: [1, 2],
  },
};

test("victory membership is affiliation-based and the day is captured only after both world reads", () => {
  const world = members(),
    trace: string[] = [];
  const result = validateVictoryDecision(
    decision,
    "exile_settled",
    Phase.Voting,
    () => {
      trace.push("world");
      return world;
    },
    () => {
      trace.push("day");
      return 3;
    },
  );
  expect(trace).toEqual(["world", "world", "day"]);
  expect<unknown>(result).toEqual({
    winner: "good",
    outcome: decision.outcome,
    decidedAt: { day: 3, phase: "voting", checkpoint: "exile_settled" },
  });
  expect(result.outcome).not.toBe(decision.outcome);
  expect(decision.reason).toBe("raw reason\n<tag>");
});

test("winner or reason failure occurs before membership and date capture", () => {
  const world = members(),
    trace: string[] = [];
  expect(() =>
    validateVictoryDecision(
      { ...decision, winner: Camp.Wolf },
      "night_settled",
      Phase.Day,
      () => {
        trace.push("world");
        return world;
      },
      () => {
        trace.push("day");
        throw new Error("day_must_not_be_read");
      },
    ),
  ).toThrow("game_result_invalid");
  expect(trace).toEqual(["world"]);
});

test("forged valid-shaped membership is refused before any date query", () => {
  const world = members(),
    trace: string[] = [];
  const forged: WinDecision = {
    winner: Camp.Good,
    reason: "literal_forged",
    outcome: {
      kind: "victory",
      primary: { kind: "faction", faction: "good", winningPlayerIds: [2] },
      additional: [],
      winningPlayerIds: [2],
    },
  };
  expect(() =>
    validateVictoryDecision(
      forged,
      "night_settled",
      Phase.Day,
      () => {
        trace.push("world");
        return world;
      },
      () => {
        trace.push("day");
        return 1;
      },
    ),
  ).toThrow("game_result_membership_invalid");
  expect(trace).toEqual(["world", "world"]);
});
