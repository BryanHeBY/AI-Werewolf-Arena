/**
 * 单元测试负责权威事实的真实提交／故障前缀与保守归因边界。输入为已安装原生命、印记及故障，
 * 预期由独立字面死亡、药瓶和阻断事实核对；不运行模型或把存活结果当作解药成功因果。
 */
import { nightStageContext } from "../../support/builders/night-stage-context";
import { resolveOrdinaryWolfKnife } from "../../../src/rulesets/ordinary-wolf-knife-routing";
import { discardStaleNightKnives } from "../../../src/rulesets/night-knife-admission";
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readReplayArchive } from "@ai-werewolf-arena/replay-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { StatusMarksComponent } from "../../../src/domain/components/status-marks";
import { Phase, StatusMark, type GameEvent } from "../../../src/domain/model";
import {
  enableReplayFacts,
  replayFactLog,
  recordPotionStock,
} from "../../../src/domain/replay-fact-log";
import { damageProtectionFacts } from "../../../src/domain/damage-evidence";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { DeathCommitter } from "../../../src/engine/death-committer";
import { GameEventRecorder } from "../../../src/app/game-event-recorder";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { createTestTempDirectory } from "../../support/drivers/temp-directories";

function target(marks: StatusMark[]) {
  const world = new World(),
    id = world.createEntity(),
    life = createAliveComponent();
  world.addComponent(id, COMPONENT.Alive, life);
  world.addComponent(id, COMPONENT.StatusMarks, new StatusMarksComponent(marks));
  return { world, id, life };
}
test("解药只证明阻断狼伤害，同时中毒仍死亡；其它盾并存时不假定单一归因", () => {
  const poison = target([StatusMark.WolfKillMark, StatusMark.HealMark, StatusMark.PoisonMark]);
  const result = new DamageResolutionSystem().resolve(poison.world);
  expect(result.deaths).toEqual([1]);
  const causes: Record<number, readonly string[]> = result.deathSources;
  expect(causes).toEqual({ 1: ["poison"] });
  expect(damageProtectionFacts(result)).toEqual([
    { targetId: 1, interaction: "wolf_attack_blocked", protection: "heal" },
  ]);
  const shielded = target([StatusMark.WolfKillMark, StatusMark.HealMark]);
  const ambiguous = new DamageResolutionSystem().resolve(shielded.world, { protectedTargets: [1] });
  expect(ambiguous.deaths).toEqual([]);
  expect(damageProtectionFacts(ambiguous)).toEqual([]);
  expect(damageProtectionFacts({ deaths: [], deathSources: {} })).toEqual([]);
});
test("库存按能力实例读取真实数据，getter与不明库存保持缺省", () => {
  const events: GameEvent[] = [];
  enableReplayFacts(events);
  recordPotionStock(events, 1, 3, "copied:potion", { heal: 0, poison: 2 });
  let reads = 0;
  recordPotionStock(events, 1, 3, "unsafe", {
    get heal() {
      reads++;
      return 1;
    },
    poison: 1,
  });
  expect(reads).toBe(0);
  expect(replayFactLog(events)!.facts).toEqual([
    {
      seq: 1,
      afterSeq: 0,
      kind: "potion_stock",
      day: 1,
      actorId: 3,
      abilityId: "copied:potion",
      heal: 0,
      poison: 2,
    },
  ]);
});
test("死亡后钩子故障也发布真实Alive前缀，无新事件时仍刷出；重试不重复制造死亡", async () => {
  const f = target([]),
    events: GameEvent[] = [];
  enableReplayFacts(events);
  const committer = new DeathCommitter({
    world: f.world,
    events,
    state: { day: 1, phase: Phase.Day, gameOver: false, result: null },
  });
  const guns: [] = [];
  Object.defineProperty(guns, "push", {
    value: () => {
      throw Error("literal_after_life_failure");
    },
  });
  expect(() => committer.markPlayersDead([f.id], false, guns)).toThrow(
    "literal_after_life_failure",
  );
  expect(f.life.alive).toBe(false);
  expect(committer.isSettledLife(f.id)).toBe(false);
  expect(events).toEqual([]);
  expect(replayFactLog(events)!.facts).toEqual([
    { seq: 1, afterSeq: 0, kind: "life_committed", day: 1, playerId: 1, alive: false, causes: [] },
  ]);
  committer.markPlayersDead([f.id], false, []);
  expect(replayFactLog(events)!.facts).toHaveLength(1);
  const manager = await SessionRecordManager.create(
    { sessionId: "fault", board: "literal", startedAtIso: "2026-10-17T00:00:00Z" },
    await createTestTempDirectory("awa-fault-fact-prefix-"),
  );
  try {
    new GameEventRecorder({ world: f.world, replayManager: manager }, Phase.Day).flush(events);
    await manager.flushNow();
    const replay = readReplayArchive(
      JSON.parse(await readFile(path.join(manager.sessionDir, "replay.json"), "utf8")),
    ).replay;
    expect(replay.events).toEqual([]);
    expect(replay.factCoverage).toEqual({ committedDeaths: 1 });
    expect(replay.facts).toEqual([
      {
        seq: 1,
        afterSeq: 0,
        kind: "life_committed",
        day: 1,
        playerId: 1,
        alive: false,
        causes: [],
      },
    ]);
  } finally {
    await manager.finalize({
      endedAtIso: "2026-10-17T00:01:00Z",
      winner: null,
      finishReason: "runtime_error",
      players: [],
    });
  }
});

test("真实刀口保留请求／映射目标及实际参与者，原生命失效撤刀追加独立事实", () => {
  const world = new World(),
    requestedId = world.createEntity(),
    effectiveId = world.createEntity();
  const requestedLife = createAliveComponent(),
    effectiveLife = createAliveComponent();
  world.addComponent(requestedId, COMPONENT.Alive, requestedLife);
  world.addComponent(effectiveId, COMPONENT.Alive, effectiveLife);
  const ctx = nightStageContext({ world, pickMajorityTarget: () => requestedId });
  enableReplayFacts(ctx.events);
  const targets = {
    ...ctx.nativeNightTargets,
    mappedTarget: () => ({
      requestedId,
      effectiveId,
      scope: { id: effectiveId, life: effectiveLife, version: 0 },
      isCurrent: () => true,
    }),
  };
  Object.defineProperty(ctx, "nativeNightTargets", { value: targets });
  ctx.state.wolfVotes = { 1: 1 };
  expect(
    resolveOrdinaryWolfKnife(
      ctx,
      [{ actorId: 8, targetId: requestedId, life: requestedLife, version: 0 }],
      [8, 9],
      new Set([9]),
      [8, 9],
    ),
  ).toBe(1);
  expect(replayFactLog(ctx.events)!.facts).toEqual([
    {
      seq: 1,
      afterSeq: 0,
      kind: "wolf_knife_committed",
      day: 1,
      participantIds: [8, 9],
      requestedTargetId: 1,
      effectiveTargetId: 2,
    },
  ]);
  world.addComponent(effectiveId, COMPONENT.Alive, createAliveComponent());
  const runtime = {
    world: () => world,
    state: () => ctx.state,
    ownsWedding: () => false,
    day: () => 1,
    events: () => ctx.events,
  };
  discardStaleNightKnives(runtime);
  expect(ctx.state.wolfTarget).toBeNull();
  expect(world.getComponent(2, COMPONENT.StatusMarks)!.has(StatusMark.WolfKillMark)).toBe(false);
  expect(replayFactLog(ctx.events)!.facts[1]).toEqual({
    seq: 2,
    afterSeq: 0,
    kind: "wolf_knife_revoked",
    day: 1,
    targetId: 2,
    reason: "stale_target",
  });
  discardStaleNightKnives(runtime);
  expect(replayFactLog(ctx.events)!.facts).toHaveLength(2);
  expect(ctx.events).toEqual([]);
});

test("God已追加而玩家投影写失败时不漏掉同前缀死亡事实", async () => {
  const f = target([]),
    events: GameEvent[] = [
      { timestamp: 1, type: "phase_changed", payload: { phase: Phase.Day, day: 1 } },
    ];
  enableReplayFacts(events);
  new DeathCommitter({
    world: f.world,
    events,
    state: { day: 1, phase: Phase.Day, gameOver: false, result: null },
  }).markPlayersDead([1], false, []);
  const manager = await SessionRecordManager.create(
    { sessionId: "player-fault", board: "literal", startedAtIso: "2026-10-17T00:00:00Z" },
    await createTestTempDirectory("awa-player-fault-fact-prefix-"),
  );
  const failure = Error("literal_player_recording_failure");
  Object.defineProperty(manager, "recordPlayerEvent", {
    value: () => {
      throw failure;
    },
  });
  try {
    expect(() =>
      new GameEventRecorder({ world: f.world, replayManager: manager }, Phase.Day).flush(events),
    ).toThrow(failure);
    expect(manager.publicEventCount).toBe(1);
    await manager.flushNow();
    const replay = readReplayArchive(
      JSON.parse(await readFile(path.join(manager.sessionDir, "replay.json"), "utf8")),
    ).replay;
    expect(replay.events.map((event) => ({ seq: event.seq, type: event.type }))).toEqual([
      { seq: 1, type: "phase_changed" },
    ]);
    expect(replay.factCoverage).toEqual({ committedDeaths: 1 });
    expect(replay.facts).toEqual([
      {
        seq: 1,
        afterSeq: 1,
        kind: "life_committed",
        day: 1,
        playerId: 1,
        alive: false,
        causes: [],
      },
    ]);
  } finally {
    await manager.finalize({
      endedAtIso: "2026-10-17T00:01:00Z",
      winner: null,
      finishReason: "runtime_error",
      players: [],
    });
  }
});
