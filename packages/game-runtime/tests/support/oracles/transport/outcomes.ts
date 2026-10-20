/**
 * 测试支持模块负责持有 SDK／ACP 传输观察及关闭的字面预期；输入为原行动者计划、已解析档案／轨迹及捕获时序，按原读取顺序输出字段检查、失败前缀及手写行动比较。不执行 IO、进程、游戏或复现，也不从生产结算推导赢家预期。
 */
import { expect } from "bun:test";
import type { ActorTransportPlan, TransportGameScenario } from "../../transport/contracts";
import type { GameRunDependencies } from "../../../../src/app/game-runner";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import type { ReplayManifest } from "../../../../src/recording/contracts";
import type { ReproductionRecord } from "../../../../src/recording/reproduction/format";
import type { MistWireState } from "../../features/mist-raven/oracles/transport";
import { assertTransportIdentity } from "./observations";
import { assertExpansionTransportEvents as assertTransportEvents } from "./expansion-observations";
type Deadline = Parameters<NonNullable<GameRunDependencies["selectRequestDeadline"]>>[0] & {
  deadlineAtMs: number;
};
type Arrival = {
  actorId: number;
  day: number;
  stage: string;
  actorOrdinal: number;
  turnId: string;
  arrivedAtMs: number;
  terminalFailure?: string;
};
type DelayedResponse = {
  actorId: number;
  actorOrdinal: number;
  completed: boolean;
  cancelledBy?: "client" | "fixture_cleanup";
};
type FailureTarget = {
  actorId: number;
  actorOrdinal: number;
  day: number;
  stage: string;
  mode: "missing" | "late" | "revoked" | undefined;
};

export function assertSdkTransportEnvelope(
  locale: "zh-CN" | "en",
  plan: ActorTransportPlan,
  body: any,
  actor: number,
  wireStates: Map<number, MistWireState>,
): void {
  if (locale === "en") expect(JSON.stringify(body.messages)).not.toMatch(/\p{Script=Han}/u);
  if (locale === "en" && (plan.mistWire || plan.verifyGameWire))
    expect(JSON.stringify(body.tools)).not.toMatch(/\p{Script=Han}/u);
  expect(body.messages[0].content).toContain(locale === "en" ? "Use English" : "你必须使用中文");
  expect(body.messages[0].content).toContain(plan.expectedName!);
  assertTransportIdentity(plan, body.messages[0].content);
  if (plan.expectedIdentityMarker)
    expect(body.messages[0].content).toContain(plan.expectedIdentityMarker);
  for (const message of body.messages)
    if (typeof message.content === "string" && message.content.startsWith('{"event":')) {
      assertTransportEvents(
        plan.eventRole ?? plan.role,
        [JSON.parse(message.content).event],
        actor,
        plan.mistWire,
        wireStates.get(actor),
      );
    }
}

export function assertRuntimeClosure(
  scenario: TransportGameScenario,
  failureThrown: boolean,
  closedState: Parameters<NonNullable<GameRunDependencies["onRuntimeClosed"]>>[0] | undefined,
  failures: string[],
): void {
  expect(failureThrown).toBe(Boolean(scenario.expectedFailure));
  expect(closedState?.closed).toBe(true);
  for (const state of [closedState?.sdk, ...(closedState?.acp ?? [])]) {
    if (!state) continue;
    expect(state.closed).toBe(true);
    expect(state.turns).toBe(0);
    expect(state.scheduler).toEqual({ closed: true, active: 0, queued: 0 });
  }
  for (const state of closedState?.acp ?? []) {
    expect(state.registry).toEqual({ closed: true, pending: 0 });
    expect(state.pool).toEqual({ closed: true, sessions: 0, creating: 0, retiring: 0 });
  }
  expect(failures).toEqual([]);
}

export function assertArchiveDecisionEnvelope(
  scenario: TransportGameScenario,
  replay: ReplayDocument,
  manifest: ReplayManifest,
  result: { snapshot: ReproductionRecord["checkpoints"][number]["snapshot"] },
): void {
  expect(replay.players.map((player) => player.role)).toEqual([...scenario.roles]);
  expect(manifest.game_result).toEqual(result.snapshot.result ?? undefined);
  expect(replay.result.decision).toEqual(result.snapshot.result ?? undefined);
}

export function assertFailedCheckpoint(
  record: ReproductionRecord,
  scenario: TransportGameScenario,
): void {
  expect(record.checkpoints.at(-1)!.complete).toBe(false);
  expect(
    record.decisions.some(
      (d) =>
        d.actorId === scenario.expectedFailure!.actorId &&
        d.stage === scenario.expectedFailure!.stage &&
        d.day === record.checkpoints.at(-1)!.snapshot.day &&
        d.outcome.kind === "error",
    ),
  ).toBe(true);
}

export function assertFailedAcpTrace(trace: any): void {
  expect(trace.failure).toBe("");
  expect(trace.schemaChecked && trace.initializationSeen).toBe(true);
}

export function assertFailureTiming(
  failureTarget: FailureTarget | undefined,
  record: ReproductionRecord,
  transportKind: (actor: number) => "llm" | "acp",
  arrivals: Arrival[],
  acpTraces: Array<{ actor: number; trace: any }>,
  deadlines: Deadline[],
  delayedResponses: DelayedResponse[],
): void {
  const target = failureTarget!;
  const targetDecisions = record.decisions.filter((d) => d.actorId === target.actorId);
  expect(targetDecisions[target.actorOrdinal - 1]).toMatchObject({
    day: target.day,
    stage: target.stage,
    outcome: { kind: "error" },
  });
  expect(
    targetDecisions.slice(0, target.actorOrdinal - 1).every((d) => d.outcome.kind === "action"),
  ).toBe(true);
  const targetArrivals =
    transportKind(target.actorId) === "llm"
      ? arrivals.filter((a) => a.actorId === target.actorId)
      : acpTraces.find((t) => t.actor === target.actorId)!.trace.arrivals;
  const arrival = targetArrivals.find(
    (a: (typeof arrivals)[number]) =>
      a.day === target.day && a.stage === target.stage && a.actorOrdinal === target.actorOrdinal,
  );
  expect(arrival).toBeDefined();
  const targetDeadline = deadlines.find(
    (d) => d.actorId === target.actorId && d.actorOrdinal === target.actorOrdinal,
  )!;
  expect(arrival.arrivedAtMs).toBeGreaterThanOrEqual(targetDeadline.nowMs);
  expect(arrival.arrivedAtMs).toBeLessThan(targetDeadline.deadlineAtMs);
  expect(deadlines.filter((d) => d.deadlineAtMs - d.nowMs === 1000)).toHaveLength(
    target.mode === "late" ? 1 : 0,
  );
  if (target.mode === "late" && transportKind(target.actorId) === "llm") {
    expect(
      delayedResponses.find(
        (d) => d.actorId === target.actorId && d.actorOrdinal === target.actorOrdinal,
      ),
    ).toMatchObject({ completed: false, cancelledBy: "client" });
  }
}

export function assertCompletedAcpTrace(
  trace: any,
  plan: ActorTransportPlan,
  locale: "zh-CN" | "en",
): void {
  expect(trace.failure).toBe("");
  expect(trace.consumed).toBe(plan.turns.length);
  expect(trace.locale).toBe(locale);
  expect(trace.schemaChecked).toBe(true);
  expect(trace.initializationSeen).toBe(true);
  expect(trace.rejected).toBe(
    plan.turns.reduce((sum, turn) => sum + (turn.invalidActions?.length ?? 0), 0),
  );
}

export function assertPlannedDecisionTape(
  record: ReproductionRecord,
  plans: ReadonlyMap<number, ActorTransportPlan>,
): void {
  for (const [actor, plan] of plans)
    expect(
      record.decisions
        .filter((decision) => decision.actorId === actor)
        .map((decision) => ({
          day: decision.day,
          stage: decision.stage,
          outcome: decision.outcome,
        })),
    ).toEqual(
      plan.turns.map((turn) => ({
        day: turn.day,
        stage: turn.stage,
        outcome: { kind: "action", action: turn.action },
      })),
    );
}
