/**
 * 单元测试负责普通刀口贵族 God 发布的惰性读取、原方法接收者和必需录制失败前缀。
 * 输入为既有原 authority fixture、手写 getter／时钟和局部录制器；字面顺序与 payload 同引用是预期。
 * 只控制这一同步发布步骤，不伪造刀权、付款、死亡或完整对局；临时时钟在 finally 恢复。
 */
import { expect, test } from "bun:test";
import { Phase, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/core/domain/world";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import type { SessionRecordManager } from "../../../../src/recording/session_recorder";
import type { ReplayRecordLogicOpInput } from "../../../../src/recording/contracts";
import { nobleBodyAuthorityFixture } from "../../../support/features/noble-secret-body/drivers/authority";
import { publishNobleNightKnife, type NobleNightKnifePublicationRuntime } from "../../../../src/game/mechanisms/roles/noble_secret_body/knife-ports";

type NobleKnifeEvent = Extract<GameEvent, { type: "noble_body_knife_committed" }>;

test("未命中贵族板只读原 World，不读取日次、事件或录制方法", () => {
  const trace: string[] = [], world = new World();
  const runtime: NobleNightKnifePublicationRuntime = {
    get world() { trace.push("world"); return world; },
    get events(): never { throw new Error("literal_events_must_not_read"); },
    get currentDay(): never { throw new Error("literal_day_must_not_read"); },
  };
  const recorder = { get recordRequiredLogicOp(): never { throw new Error("literal_recorder_must_not_read"); } } as unknown as SessionRecordManager;
  expect(runWithSessionRecorder(recorder, () => publishNobleNightKnife(() => { trace.push("context"); return runtime; }, null))).toBeUndefined();
  expect(trace).toEqual(["context", "world"]);
});

test("原 World 和日次晚读，push 方法先于时钟，记录与 God 事件持同一 payload", () => {
  const f = nobleBodyAuthorityFixture(), events: GameEvent[] = [], trace: string[] = [];
  const recorded: ReplayRecordLogicOpInput[] = [];
  const runtime: NobleNightKnifePublicationRuntime = {
    get world() { trace.push("world"); return f.world; },
    get events() { trace.push("events"); return events; },
    get currentDay() {
      trace.push("day-callee");
      return function(this: unknown) { expect(this).toBe(runtime); trace.push("day"); return 2; };
    },
  };
  Object.defineProperty(events, "push", {
    get() {
      trace.push("push-callee");
      return function(this: GameEvent[], event: GameEvent) {
        expect(this).toBe(events);
        trace.push("push");
        return Array.prototype.push.call(this, event);
      };
    },
  });
  const recorder = {
    get recordRequiredLogicOp() {
      trace.push("record-callee");
      return function(this: unknown, input: ReplayRecordLogicOpInput) {
        expect(this).toBe(recorder); trace.push("record"); recorded.push(input);
      };
    },
  } as unknown as SessionRecordManager;
  const now = Date.now;
  Date.now = function(this: unknown) { expect(this).toBe(Date); trace.push("clock"); return 777; };
  try {
    runWithSessionRecorder(recorder, () => publishNobleNightKnife(() => { trace.push("context"); return runtime; }, 6));
  } finally {
    Date.now = now;
  }
  expect(trace).toEqual([
    "context", "world", "context", "world", "context", "day-callee", "day",
    "context", "events", "push-callee", "clock", "push", "record-callee", "record",
  ]);
  expect(events).toEqual([{
    timestamp: 777, type: "noble_body_knife_committed",
    payload: { policy: "awa_noble_secret_body_v1", actorId: 1, day: 2, targetId: 6 },
    audience: [],
  }]);
  expect(Object.isFrozen((events[0]! as NobleKnifeEvent).audience)).toBe(true);
  expect(recorded).toEqual([{
    scope: "phase_pipeline", op: "noble_body_knife_committed", phase: Phase.Night, status: "ok",
    output: { policy: "awa_noble_secret_body_v1", actorId: 1, day: 2, targetId: 6 },
  }]);
  expect(recorded[0]!.output).toBe((events[0]! as NobleKnifeEvent).payload);
});

test("必需记录抛原错误仍保已发表 God 事件和原 payload，不补发或删除前缀", () => {
  const f = nobleBodyAuthorityFixture(), events: GameEvent[] = [];
  const failure = new Error("literal_required_knife_record_failure"), captured: ReplayRecordLogicOpInput[] = [];
  const runtime: NobleNightKnifePublicationRuntime = { world: f.world, events, currentDay: () => 3 };
  const recorder = {
    recordRequiredLogicOp(input: ReplayRecordLogicOpInput) { captured.push(input); throw failure; },
  } as unknown as SessionRecordManager;
  expect(() => runWithSessionRecorder(recorder, () => publishNobleNightKnife(() => runtime, null))).toThrow(failure);
  expect(events).toHaveLength(1);
  expect(events[0]!.type).toBe("noble_body_knife_committed");
  expect((events[0]! as NobleKnifeEvent).payload).toEqual({ policy: "awa_noble_secret_body_v1", actorId: 1, day: 3, targetId: null });
  expect((events[0]! as NobleKnifeEvent).audience).toEqual([]);
  expect(captured).toHaveLength(1);
  expect(captured[0]!.output).toBe((events[0]! as NobleKnifeEvent).payload);
});
