/**
 * 单元测试验证馥郁双生事实构造、原公开根匹配以及事件先于必要记录的失败前缀。
 * 输入是字面死亡/阶段表、结构化 receipt 和受控发布端口；独立手写的 payload、引用身份与调用序列是预期。
 * 结构化 receipt 在此只检查构造与路由，不冒充真正权威发行的披露权限；本测试不运行 World、阶段、模型或文件记录。
 */
import { expect, test } from "bun:test";
import { FragrantDeathWavePublication } from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/death-wave";
import type { FragrantWaveReceipt } from "../../../../src/game/mechanisms/roles/fragrant_pair_seer/authority";
import { Phase, DeathCause, type GameEvent } from "../../../../src/domain/model";
import { runWithSessionRecorder } from "../../../../src/recording/recording_context";
import type { SessionRecordManager } from "../../../../src/recording/session_recorder";

const receipt: FragrantWaveReceipt = { day: 1, rootId: 9, addedTargetId: 10, pairIds: [9, 10] };
function fixture(events: GameEvent[] = []) {
  const trace: string[] = [],
    published: Array<{ receipt: FragrantWaveReceipt; event: GameEvent }> = [];
  const publication = new FragrantDeathWavePublication({
    actorId() {
      trace.push("actor");
      return 1;
    },
    get phase() {
      trace.push("phase");
      return Phase.Day;
    },
    get day() {
      trace.push("day");
      return 1;
    },
    get events() {
      trace.push("events");
      return events;
    },
    publish(receipt, event) {
      trace.push(`publish:${events.length}`);
      published.push({ receipt, event });
    },
  });
  return { trace, events, published, publication };
}

test("committed facts precede public-root publication and required records without copying the receipt pair", () => {
  const root: GameEvent = { timestamp: 1, type: "voted_out", payload: { target: 9 } },
    f = fixture([root]);
  expect(f.trace).toEqual([]);
  const records: string[] = [],
    recorder = {
      recordRequiredLogicOp(input: Parameters<SessionRecordManager["recordRequiredLogicOp"]>[0]) {
        records.push(input.op);
        f.trace.push(`record:${input.op}:${f.events.length}`);
      },
    } as unknown as SessionRecordManager;
  runWithSessionRecorder(recorder, () =>
    f.publication.recordCommittedWave(
      receipt,
      [9, 10],
      { 9: [DeathCause.WolfKill], 10: [DeathCause.FragrantLink] },
      new Map([[9, Phase.Night]]),
      true,
    ),
  );
  expect(f.events.map((e) => e.type)).toEqual([
    "voted_out",
    "fragrant_wave_committed",
    "fragrant_link_triggered",
  ]);
  expect(f.events[1]!.payload).toEqual({
    policy: "awa_fragrant_pair_seer_v1",
    actorId: 1,
    day: 1,
    deaths: [9, 10],
    deathSources: { "9": [DeathCause.WolfKill], "10": [DeathCause.FragrantLink] },
    deathPhases: { "9": "night", "10": "day" },
    initialWave: true,
  });
  expect(f.events[2]!.payload).toEqual({
    policy: "awa_fragrant_pair_seer_v1",
    actorId: 1,
    day: 1,
    bindingId: "fragrant:night:1",
    pairIds: [9, 10],
    rootId: 9,
    addedTargetId: 10,
    rootPhase: "night",
    initialWave: true,
  });
  expect(
    (f.events[2] as Extract<GameEvent, { type: "fragrant_link_triggered" }>).payload.pairIds,
  ).toBe(receipt.pairIds);
  expect((f.events[1] as Extract<GameEvent, { type: "fragrant_wave_committed" }>).audience).toEqual(
    [],
  );
  expect(
    Object.isFrozen(
      (f.events[1] as Extract<GameEvent, { type: "fragrant_wave_committed" }>).audience,
    ),
  ).toBe(true);
  expect(f.published).toEqual([{ receipt, event: root }]);
  expect(records).toEqual(["fragrant_wave_committed", "fragrant_link_triggered"]);
  expect(f.trace).toEqual([
    "actor",
    "phase",
    "day",
    "events",
    "events",
    "events",
    "publish:3",
    "phase",
    "record:fragrant_wave_committed:3",
    "phase",
    "record:fragrant_link_triggered:3",
  ]);
});

test("invalid terminal origin fails before facts or recording", () => {
  const f = fixture();
  expect(() =>
    f.publication.recordCommittedWave(null, [9], {}, new Map([[9, Phase.GameOver]]), false),
  ).toThrow("fragrant_death_origin_invalid");
  expect(f.events).toEqual([]);
  expect(f.published).toEqual([]);
  expect(f.trace).toEqual(["actor"]);
});

test("a required record failure retains both inert facts and does not attempt the later link record", () => {
  const f = fixture(),
    calls: string[] = [],
    recorder = {
      recordRequiredLogicOp(input: Parameters<SessionRecordManager["recordRequiredLogicOp"]>[0]) {
        calls.push(input.op);
        throw Error("test_required_record_failed");
      },
    } as unknown as SessionRecordManager;
  expect(() =>
    runWithSessionRecorder(recorder, () =>
      f.publication.recordCommittedWave(
        receipt,
        [9, 10],
        {},
        new Map([
          [9, Phase.Night],
          [10, Phase.Night],
        ]),
        false,
      ),
    ),
  ).toThrow("test_required_record_failed");
  expect(f.events.map((e) => e.type)).toEqual([
    "fragrant_wave_committed",
    "fragrant_link_triggered",
  ]);
  expect(calls).toEqual(["fragrant_wave_committed"]);
  expect(f.published).toEqual([]);
});

test("visible-wave filtering preserves the actual event identity and never publishes unrelated deaths", () => {
  const f = fixture(),
    unrelated: GameEvent = { timestamp: 1, type: "additional_deaths", payload: { deaths: [11] } },
    visible: GameEvent = { timestamp: 2, type: "additional_deaths", payload: { deaths: [10] } };
  f.publication.publishVisibleWave(null, visible);
  f.publication.publishVisibleWave(receipt, unrelated);
  expect(f.trace).toEqual([]);
  f.publication.publishVisibleWave(receipt, visible);
  expect(f.published).toHaveLength(1);
  expect(f.published[0]!.receipt).toBe(receipt);
  expect(f.published[0]!.event).toBe(visible);
});
