/** 独立验算单元反例（非完整Tape结构测试）：已知真实候选后的未发表付款前缀只能保存同一合法选择，不能任意加目标。 */
import { expect, test } from "bun:test";
import { crowTwelveConfig } from "../../../../src/rulesets/presets/crow-twelve";
import { validateCrowRecord } from "../../../../src/recording/verification/crow/validate";
import type { ReproductionRecord } from "../../../../src/recording/reproduction/format";
const roles = [
  "wolf",
  "wolf",
  "wolf",
  "wolf",
  "villager",
  "villager",
  "villager",
  "villager",
  "seer",
  "witch",
  "hunter",
  "crow",
];
function failedPrefix(): ReproductionRecord {
  const config = structuredClone(crowTwelveConfig);
  return {
    metadata: {
      normalizedBoard: config,
      players: roles.map((role, i) => ({ id: i + 1, role, camp: i < 4 ? "wolf" : "good" })),
    },
    events: [],
    decisions: [
      {
        actorId: 12,
        day: 1,
        stage: "crow_curse",
        openedAtEventCount: 0,
        request: {
          actorId: 12,
          phase: "night",
          allowedTools: ["curse_exile"],
          context: {
            day: 1,
            stage: "crow_curse",
            action_failure_policy: "error",
            allow_fallback: false,
            crow_candidates: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          },
        },
        outcome: { kind: "error", code: "decision_failed", name: "Error" },
        returnedCandidate: { name: "curse_exile", args: { target_id: 5 } },
      },
    ],
    checkpoints: [
      {
        eventCount: 0,
        complete: false,
        players: roles.map((role, i) => ({
          id: i + 1,
          role,
          camp: i < 4 ? "wolf" : "good",
          alive: true,
          privateState:
            role === "crow" ? { crow: { ...config.crow, history: [{ day: 1, targetId: 5 }] } } : {},
        })),
      },
    ],
  } as unknown as ReproductionRecord;
}
test("已知候选的合法未发表付款前缀可审计", () => {
  expect(() => validateCrowRecord(failedPrefix())).not.toThrow();
});
for (const target of [12, 6, null])
  test(`伪造失败CP末选择${target}必须拒绝`, () => {
    const record = failedPrefix();
    const state = record.checkpoints[0]!.players[11]!.privateState.crow as {
      history: Array<{ day: number; targetId: number | null }>;
    };
    state.history[0]!.targetId = target;
    expect(() => validateCrowRecord(record)).toThrow("reproduction_crow_invalid");
  });
test("已知候选不能借伪造候选列表允许自选", () => {
  const record = failedPrefix(),
    d = record.decisions[0]!;
  d.request.context.crow_candidates = [12];
  d.returnedCandidate = { name: "curse_exile", args: { target_id: 12 } };
  (record.checkpoints[0]!.players[11]!.privateState.crow as { history: unknown[] }).history = [
    { day: 1, targetId: 12 },
  ];
  expect(() => validateCrowRecord(record)).toThrow("reproduction_crow_invalid");
});

test("伪造fallback标签不能无决定地制造实投票或修复弃票", () => {
  for (const abstain of [false, true]) {
    const record = failedPrefix();
    record.decisions = [];
    record.checkpoints = [];
    record.events = [
      { timestamp: 1, type: "phase_changed", payload: { day: 1, phase: "voting" } },
      {
        timestamp: 2,
        type: "vote_cast",
        payload: {
          actorId: 1,
          targetId: abstain ? null : 5,
          abstain,
          weight: abstain ? 0 : 1,
          fallback: true,
        },
      },
    ];
    expect(() => validateCrowRecord(record)).toThrow("reproduction_crow_invalid");
  }
});
