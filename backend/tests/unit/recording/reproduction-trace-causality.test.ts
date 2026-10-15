/**
 * 负责 Trace 开启／结算、通知失败与最终拒绝的已提交前缀测试。输入为初始化 World、原请求及受控 provider／通知。
 * 输出由手写 turn、opening、settleOrder 与原错误身份核对；预期不由轨迹实现计算。
 * 只初始化 checkpoint，不运行游戏周期、完整复盘、计费模型或历史 golden；轨迹不代表资源付款。
 */
import { expect, test } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { Camp, Phase, Role, type ActionRequest, type ToolCall } from "@ai-werewolf-arena/game-contract";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { createRandom } from "../../../src/domain/random";
import { ReproductionTrace, normalizedRequest } from "../../../src/recording/reproduction/trace";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { captureCheckpoint } from "../../../src/app/simulation/reproduction-context";
const action: ToolCall = { name: "kill_vote", args: { target_id: 3, abstain: false } };
function fixture(onChange: () => void = () => {}) {
  const deck = sixPlayerMvpConfig.roleSetups.flatMap(({ role, count }) => Array<Role>(count).fill(role));
  const game = bootstrapGame(sixPlayerMvpConfig, { fixedRoles: deck, random: createRandom("trace-causality-prefix") });
  const metadata = {
    engine: { id: "awa-engine" as const, sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
    random: game.random.metadata, ruleset: RULESET, boardId: "trace_causality", normalizedBoard: sixPlayerMvpConfig,
    locale: "zh-CN" as const, maxDays: 1, dealMode: "fixed" as const,
    players: deck.map((role, i) => ({ id: i + 1, name: `Player ${i + 1}`, role, camp: role === Role.Wolf ? Camp.Wolf : Camp.Good })),
  };
  const checkpoint = captureCheckpoint(game.world, game.phaseManager.getSnapshot(), 0, true, 0);
  let armed = false;
  const trace = new ReproductionTrace(metadata, () => { if (armed) onChange(); });
  trace.checkpoint(checkpoint, []);
  armed = true;
  const request: ActionRequest = {
    actorId: 1, phase: Phase.Night, deadlineAtMs: 1234, allowedTools: ["kill_vote"],
    context: { day: 1, stage: "wolf_vote", visible_events: [], turn_constraints: { min_valid_actions: 1, max_valid_actions: 1, required_any_tools: ["kill_vote"] } },
  };
  return { trace, request, checkpoint, metadata };
}
test("normalization detaches archive facts while provider receives the original request", async () => {
  const { trace, request } = fixture(), normalized = normalizedRequest(request);
  expect(Object.hasOwn(normalized, "deadlineAtMs")).toBe(false);
  normalized.context.turn_constraints.required_any_tools!.length = 0;
  expect(request.context.turn_constraints.required_any_tools).toEqual(["kill_vote"]);
  let actual: ActionRequest | undefined;
  await trace.decide(request, { getAction: async (received) => { actual = received; return action; } });
  expect(actual).toBe(request);
  const recorded = trace.build().decisions[0]!;
  expect(Object.hasOwn(recorded.request, "deadlineAtMs")).toBe(false);
  expect(recorded.request.context.turn_constraints.required_any_tools).toEqual(["kill_vote"]);
});
test("opening notification failure commits pending and turn before any provider call", async () => {
  let fail = true, calls = 0;
  const original = new Error("opening notification failure");
  const { trace, request } = fixture(() => { if (fail) throw original; });
  const provider = { getAction: async () => { calls++; return action; } };
  await expect(trace.decide(request, provider)).rejects.toBe(original);
  expect(calls).toBe(0);
  expect(trace.build().decisions.map(({ turn, openedAfterSettlement, outcome }) => ({ turn, openedAfterSettlement, outcome })))
    .toEqual([{ turn: 1, openedAfterSettlement: 0, outcome: { kind: "pending" } }]);
  fail = false; await trace.decide(request, provider);
  expect(trace.build().decisions.map(({ turn, settleOrder }) => ({ turn, settleOrder })))
    .toEqual([{ turn: 1, settleOrder: undefined }, { turn: 2, settleOrder: 1 }]);
  expect(() => trace.build({ operations: [], termination: { reason: "runtime_timeout", winner: null } })).toThrow("reproduction_decisions_pending");
});
test("direct settlement notification failure retains catch prefix and increments twice", async () => {
  let notices = 0;
  const original = new TypeError("settlement notification failure");
  const { trace, request } = fixture(() => { if (++notices === 2) throw original; });
  await expect(trace.decide(request, { getAction: async () => action })).rejects.toBe(original);
  expect(notices).toBe(3); expect(trace.settlementCount).toBe(2);
  expect(trace.build().decisions[0]).toMatchObject({ turn: 1, openedAfterSettlement: 0, settleOrder: 2, outcome: { kind: "error", code: "decision_failed", name: "TypeError" } });
});
test("parallel openings keep opening cursor separate from completion order", async () => {
  const { trace, request } = fixture();
  let firstResolve!: (value: ToolCall) => void, secondResolve!: (value: ToolCall) => void;
  const first = trace.decide(request, { getAction: () => new Promise(resolve => { firstResolve = resolve; }) });
  const second = trace.decide(request, { getAction: () => new Promise(resolve => { secondResolve = resolve; }) });
  expect(trace.decisionCount).toBe(2);
  secondResolve(action); await second; firstResolve(action); await first;
  await trace.decide(request, { getAction: async () => action });
  expect(trace.build().decisions.map(({ turn, openedAfterSettlement, settleOrder }) => ({ turn, openedAfterSettlement, settleOrder }))).toEqual([
    { turn: 1, openedAfterSettlement: 0, settleOrder: 2 }, { turn: 2, openedAfterSettlement: 0, settleOrder: 1 }, { turn: 3, openedAfterSettlement: 2, settleOrder: 3 },
  ]);
});
test("checkpoint count mismatch writes nothing and notification failure retains committed snapshot", () => {
  let notices = 0;
  const original = new Error("checkpoint notification failure");
  const { trace, checkpoint } = fixture(() => { notices++; throw original; });
  expect(() => trace.checkpoint({ ...checkpoint, eventCount: 1 }, [])).toThrow("reproduction_checkpoint_events_mismatch");
  expect(notices).toBe(0); expect(trace.build().checkpoints).toEqual([checkpoint]);
  expect(() => trace.checkpoint(checkpoint, [])).toThrow(original);
  expect(notices).toBe(1);
  checkpoint.players[0]!.name = "caller mutation";
  expect(trace.build().checkpoints[0]!.players[0]!.name).toBe("玩家1");
});
test("final invalid refusal precedes pending and ordered failures retain only safe names", async () => {
  let fail = true;
  const { trace, request } = fixture(() => { if (fail) throw new Error("held opening"); });
  await expect(trace.decide(request, { getAction: async () => action })).rejects.toThrow("held opening");
  fail = false;
  trace.noteFailure("cycle", new RangeError("private cycle data")); trace.noteFailure("cleanup", new TypeError("private cleanup data"));
  const final = { operations: [], termination: { reason: "runtime_timeout", winner: null } };
  expect(() => trace.build(final)).toThrow("reproduction_decisions_pending");
  trace.invalidate(); expect(() => trace.build(final)).toThrow("reproduction_trace_incomplete");
  const clean = fixture().trace;
  clean.noteFailure("cycle", new RangeError("private cycle data")); clean.noteFailure("cleanup", new TypeError("private cleanup data"));
  expect(clean.build(final).termination!.errors).toEqual([{ scope: "cycle", name: "RangeError" }, { scope: "cleanup", name: "TypeError" }]);
});
