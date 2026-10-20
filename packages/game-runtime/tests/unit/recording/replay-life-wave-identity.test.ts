/**
 * 单元层核对真实DeathCommitter与DeathWaveUnit的录像身份接线。输入为独立初始/追加波、事件插入和提交后故障，输出字面waveId及生命前缀。
 * 不根据相邻afterSeq生成预期、不运行模型；复制日志、旧legacy与外来plan均验证身份不扩大规则权限或访问器读取。
 */
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { DeathCause, Phase, type GameEvent, type DeathSources } from "../../../src/domain/model";
import {
  copyReplayFacts,
  enableReplayFacts,
  replayFactLog,
} from "../../../src/domain/replay-fact-log";
import { DeathCommitter } from "../../../src/engine/death-committer";
import {
  openDeathWave,
  planDeathWave,
  replayDeathWaveIdentity,
  type DeathWavePlan,
  type DeathWaveUnit,
} from "../../../src/engine/death-wave";

function setup() {
  const world = new World(),
    events: GameEvent[] = [];
  for (let index = 0; index < 6; index++)
    world.addComponent(world.createEntity(), COMPONENT.Alive, createAliveComponent());
  enableReplayFacts(events);
  const committer = new DeathCommitter({
    world,
    events,
    state: { day: 2, phase: Phase.Day, gameOver: false, result: null },
  });
  return { world, events, committer };
}
function commit(
  committer: DeathCommitter,
  ids: number[],
  unit: DeathWaveUnit,
  causes: DeathSources = {},
  guns: [] = [],
) {
  return committer.markPlayersDead(
    ids,
    false,
    guns,
    false,
    causes,
    undefined,
    planDeathWave(
      ids,
      causes,
      unit.kind === "initial" ? "initial" : "additional",
      undefined,
      undefined,
      [],
      [unit],
    ),
  );
}
test("真实初始波同编号，追加proposal跨事件仍同编号，不同proposal同afterSeq也不同编号", () => {
  const { events, committer } = setup(),
    initial = openDeathWave("initial", 2, Phase.Day),
    additional = openDeathWave("additional", 2, Phase.Day),
    next = openDeathWave("additional", 2, Phase.Day);
  commit(committer, [1, 2], initial, { 1: [DeathCause.Poison], 2: [DeathCause.WolfKill] });
  commit(committer, [3], additional);
  events.push({ timestamp: 1, type: "additional_deaths", payload: { deaths: [3] } });
  commit(committer, [4], additional);
  commit(committer, [5], next);
  expect(replayFactLog(events)!.facts).toEqual([
    {
      seq: 1,
      afterSeq: 0,
      day: 2,
      kind: "life_committed",
      playerId: 1,
      alive: false,
      causes: ["poison"],
      waveId: 1,
    },
    {
      seq: 2,
      afterSeq: 0,
      day: 2,
      kind: "life_committed",
      playerId: 2,
      alive: false,
      causes: ["wolf_kill"],
      waveId: 1,
    },
    {
      seq: 3,
      afterSeq: 0,
      day: 2,
      kind: "life_committed",
      playerId: 3,
      alive: false,
      causes: [],
      waveId: 2,
    },
    {
      seq: 4,
      afterSeq: 1,
      day: 2,
      kind: "life_committed",
      playerId: 4,
      alive: false,
      causes: [],
      waveId: 2,
    },
    {
      seq: 5,
      afterSeq: 1,
      day: 2,
      kind: "life_committed",
      playerId: 5,
      alive: false,
      causes: [],
      waveId: 3,
    },
  ]);
});
test("Alive之后故障保留真实wave前缀，同波续提不换编号，重试不补造第二死亡", () => {
  const { world, events, committer } = setup(),
    unit = openDeathWave("initial", 2, Phase.Day),
    guns: [] = [];
  Object.defineProperty(guns, "push", {
    value: () => {
      throw Error("literal_after_life_failure");
    },
  });
  expect(() => commit(committer, [1, 2], unit, {}, guns)).toThrow("literal_after_life_failure");
  expect(world.getComponent(1, COMPONENT.Alive)!.alive).toBe(false);
  expect(world.getComponent(2, COMPONENT.Alive)!.alive).toBe(true);
  commit(committer, [2], unit);
  commit(committer, [1], unit);
  expect(replayFactLog(events)!.facts).toEqual([
    {
      seq: 1,
      afterSeq: 0,
      day: 2,
      kind: "life_committed",
      playerId: 1,
      alive: false,
      causes: [],
      waveId: 1,
    },
    {
      seq: 2,
      afterSeq: 0,
      day: 2,
      kind: "life_committed",
      playerId: 2,
      alive: false,
      causes: [],
      waveId: 1,
    },
  ]);
});
test("复制事实保留已分配编号且隔离后续追加，未知/多单位/legacy不编造唯一波", () => {
  const { world, events, committer } = setup(),
    first = openDeathWave("initial", 2, Phase.Day);
  commit(committer, [1], first);
  const copied: GameEvent[] = [];
  copyReplayFacts(events, copied);
  const copiedCommitter = new DeathCommitter({
    world,
    events: copied,
    state: { day: 2, phase: Phase.Day, gameOver: false, result: null },
  });
  commit(copiedCommitter, [2], first);
  commit(copiedCommitter, [3], openDeathWave("additional", 2, Phase.Day));
  expect(
    replayFactLog(copied)!.facts.map((f) => (f.kind === "life_committed" ? f.waveId : null)),
  ).toEqual([1, 1, 2]);
  expect(replayFactLog(events)!.facts).toHaveLength(1);
  let reads = 0;
  expect(
    replayDeathWaveIdentity({
      get units() {
        reads++;
        return [first];
      },
    } as unknown as DeathWavePlan),
  ).toBeUndefined();
  expect(reads).toBe(0);
  expect(replayDeathWaveIdentity(planDeathWave([], {}, "legacy"))).toBeUndefined();
  expect(
    replayDeathWaveIdentity(
      planDeathWave(
        [],
        {},
        "initial",
        undefined,
        undefined,
        [],
        [first, openDeathWave("additional")],
      ),
    ),
  ).toBeUndefined();
});
