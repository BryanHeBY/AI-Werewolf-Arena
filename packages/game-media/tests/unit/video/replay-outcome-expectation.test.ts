/**
 * 单元测试负责浏览器终局oracle的独立来源边界。输入为手写原事件、不同座次与实际阵营不一致的明确成员，输出字面结果／原因／成员。
 * 本层不调用编译器或React组件；未记录成员、明确无人获胜、个人与关系结果必须分开，防止测试替渲染器补推断。
 */
import { expect, test } from "bun:test";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { replayOutcomeExpectation } from "../../support/replay-outcome-expectation";
const players: ReplayDocument["players"] = [
  { player_id: 1, seat: 9, name: "Ada", role: "wolf", camp: "wolf" },
  { player_id: 2, name: "匿名乙", role: "villager", camp: "good" },
  { player_id: 3, role: "seer", camp: "good" },
];
const event = (payload: ReplayEvent["payload"]): ReplayEvent => ({
  seq: 1,
  type: "game_over",
  phase: "game_over",
  day: 2,
  timestamp: "review",
  payload,
});

test("typed primary and additional claims retain exact members and separate internal id from display seat", () => {
  const source = event({
    winner: "good",
    reason: "review_reason",
    outcome: {
      kind: "victory",
      primary: { kind: "faction", faction: "good", winningPlayerIds: [2] },
      additional: [
        { kind: "individual", playerId: 1, goalId: "review_goal", winningPlayerIds: [1] },
      ],
      winningPlayerIds: [1, 2],
    },
  });
  const before = JSON.stringify(source);
  expect(replayOutcomeExpectation(source, players, "zh-CN")).toEqual({
    primary: "好人阵营胜利",
    hasPrimaryClaim: true,
    additional: [{ ids: [1], text: "附加结果 · 9号·Ada个人目标胜利（review_goal） · 9号 · Ada" }],
    winnerIds: [1, 2],
    winnerLabels: ["9号 · Ada", "2号 · 匿名乙"],
    winnersText: "获胜玩家：9号 · Ada / 2号 · 匿名乙",
    reason: "判胜原因：review_reason",
  });
  expect(JSON.stringify(source)).toBe(before);
});

test("legacy unknown, legacy faction, and explicit no-winner never invent a member list", () => {
  const legacy = replayOutcomeExpectation(
    event({ winner: "good", reason: "review_reason" }),
    players,
    "en",
  );
  expect(legacy.primary).toBe("Good team");
  expect(legacy.winnerIds).toBeNull();
  expect(legacy.winnersText).toBeNull();
  expect(legacy.additional).toEqual([]);
  const unknown = replayOutcomeExpectation(event({ winner: null, reason: null }), players, "en");
  expect(unknown.primary).toBe("Unknown record");
  expect(unknown.winnerIds).toBeNull();
  expect(unknown.reason).toBeNull();
  const none = replayOutcomeExpectation(
    event({ winner: null, reason: "review_reason", outcome: { kind: "no_winner" } }),
    players,
    "en",
  );
  expect(none.primary).toBe("No winner");
  expect(none.winnerIds).toEqual([]);
  expect(none.winnerLabels).toEqual([]);
  expect(none.winnersText).toBe("Winning players: None");
});

test("individual and relationship labels come from explicit targets, while malformed union membership is rejected", () => {
  const individual = replayOutcomeExpectation(
    event({
      winner: null,
      outcome: {
        kind: "victory",
        primary: { kind: "individual", playerId: 1, goalId: "review_goal", winningPlayerIds: [1] },
        additional: [],
        winningPlayerIds: [1],
      },
    }),
    players,
    "en",
  );
  expect(individual.primary).toBe("Player 9·Ada's personal goal victory (review_goal)");
  expect(individual.winnerIds).toEqual([1]);
  const relationship = replayOutcomeExpectation(
    event({
      winner: null,
      outcome: {
        kind: "victory",
        primary: { kind: "relationship", groupId: "review_pair", winningPlayerIds: [1, 3] },
        additional: [],
        winningPlayerIds: [1, 3],
      },
    }),
    players,
    "en",
  );
  expect(relationship.primary).toBe("Relationship group review_pair wins");
  expect(relationship.winnerIds).toEqual([1, 3]);
  expect(() =>
    replayOutcomeExpectation(
      event({
        winner: "good",
        outcome: {
          kind: "victory",
          primary: { kind: "faction", faction: "good", winningPlayerIds: [2] },
          additional: [],
          winningPlayerIds: [2, 3],
        },
      }),
      players,
      "en",
    ),
  ).toThrow();
});
