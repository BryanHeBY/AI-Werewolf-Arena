/**
 * 负责单元测试： Trace 每次 build 的单次独立事件快照及来源读取失败后的轨迹保持。
 * 输入为初始化事件／checkpoint、公开板子、受控读取端口及丘比特／混血儿真实选择阶段；不推进完整对局。
 * 输出核对单次读取、快照脱离、原读取失败，以及实际录制入口在 checkpoint 前捕获选择事实并保留隐私拒绝。
 * 管理器替身只捕获入口传入的回调；事件读取与归档副本各自持有数据，不用计时器或磁盘吞吐制造时序。
 */
import { expect, test } from "bun:test";
import { RULESET } from "@ai-werewolf-arena/game-catalog";
import { type ReproductionMetadata } from "../../../src/recording/reproduction/format";
import { ReproductionTrace } from "../../../src/recording/reproduction/trace";
import {
  beginGameReproduction,
  captureCheckpoint,
  currentEngineVersion,
} from "../../../src/app/simulation/reproduction-context";
import { radiantFixture } from "../../support/features/radiant-eclipse/builders/runtime-game";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { Camp, COMPONENT, Phase, Role, WinCondition, type GameEvent } from "../../../src/domain";
import { SessionRecordManager } from "../../../src/recording/session/recorder";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import { HYBRID_STAGE } from "../../../src/features/hybrid/night-stage";
import { CUPID_STAGE } from "../../../src/features/cupid/night-stage";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { nightStageContext, executeNightStage } from "../../support/builders/night-stage-context";
import { validateHybridRecord } from "../../../src/recording/verification/hybrid/validate";
import { validateCupidRecord } from "../../../src/recording/verification/cupid/validate";
async function fixture() {
  const f = await radiantFixture();
  const events = f.phaseManager.getEvents();
  const cp = captureCheckpoint(f.world, f.phaseManager.getSnapshot(), 0, true, events.length);
  const metadata: ReproductionMetadata = {
    engine: await currentEngineVersion(),
    boardId: f.board.definition.id,
    normalizedBoard: f.board.config,
    locale: f.world.locale,
    maxDays: 6,
    dealMode: f.dealMode,
    ruleset: RULESET,
    random: f.random.metadata,
    players: cp.players.map(({ id, name, role, camp }) => ({ id, name, role, camp })),
  };
  return { f, cp, metadata, events };
}
test("one owner snapshot per build is detached from source and returned mutable archive", async () => {
  const { f, cp, metadata, events } = await fixture();
  let source = structuredClone(events),
    calls = 0;
  const trace = new ReproductionTrace(
    metadata,
    () => {},
    () => {
      calls++;
      return source;
    },
  );
  trace.checkpoint(cp, events);
  const first = trace.build();
  expect(calls).toBe(1);
  const initial = JSON.stringify(first);
  const sourceInfo = source.find((e) => e.type === "god_private_game_info")!;
  sourceInfo.payload.players[0]!.name = "SYNTHETIC_CANARY";
  expect(JSON.stringify(first)).toBe(initial);
  expect(f.phaseManager.getEvents()).toEqual(events);
  source = structuredClone(events);
  const info = first.events.find((e) => e.type === "god_private_game_info")!;
  (info.payload.players as Array<{ name: string }>)[0]!.name = "RETURNED_CANARY";
  first.checkpoints[0]!.players[0]!.privateState.abilities = {};
  const second = trace.build();
  expect(calls).toBe(2);
  expect(JSON.stringify(second.events)).toBe(JSON.stringify(events));
  expect(second.checkpoints[0]).toEqual(cp);
});
test("short live stream is rejected without changing the checkpoint snapshot", async () => {
  const { cp, metadata, events } = await fixture();
  let short = true;
  const trace = new ReproductionTrace(
    metadata,
    () => {},
    () => (short ? events.slice(0, 1) : events),
  );
  trace.checkpoint(cp, events);
  expect(() => trace.build()).toThrow("reproduction_live_events_before_checkpoint");
  short = false;
  expect(trace.build().checkpoints).toEqual([cp]);
});
test("callback failure is propagated and a later valid snapshot has unchanged trace input", async () => {
  const { cp, metadata, events } = await fixture();
  let fail = true;
  const trace = new ReproductionTrace(
    metadata,
    () => {},
    () => {
      if (fail) throw new Error("synthetic_live_read_failure");
      return events;
    },
  );
  trace.checkpoint(cp, events);
  expect(() => trace.build()).toThrow("synthetic_live_read_failure");
  fail = false;
  expect(JSON.stringify(trace.build().events)).toBe(JSON.stringify(events));
  expect(trace.build().checkpoints).toEqual([cp]);
});

/** 捕获真实 beginGameReproduction 给管理器的输入；不用自造 liveEvents 替代待测接线。 */
function recordingEntry(context: ReturnType<typeof bootstrapGame>) {
  let observedLiveEvents: (() => readonly GameEvent[]) | undefined;
  const manager: SessionRecordManager = Object.create(SessionRecordManager.prototype);
  Object.defineProperty(manager, "beginReproduction", {
    value(metadata: ReproductionMetadata, liveEvents?: () => readonly GameEvent[]) {
      observedLiveEvents = liveEvents;
      return new ReproductionTrace(metadata, () => {}, liveEvents);
    },
  });
  const trace = beginGameReproduction(manager, context, {
    engine: { id: "awa-engine", sourceHash: "a".repeat(64), lockHash: "b".repeat(64) },
    boardId: "literal_live_wiring",
    locale: context.world.locale,
    maxDays: 2,
  });
  return { trace, liveEvents: observedLiveEvents };
}

test("Hybrid beginGame wiring includes pre-checkpoint facts without relaxing private-event validation", async () => {
  const roles = [Role.Hybrid, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];
  const context = bootstrapGame(
    {
      ...sixPlayerMvpConfig,
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((value) => value === role).length,
      })),
      winConditions: [WinCondition.SlaughterCity],
    },
    { fixedRoles: roles, locale: "en" },
  );
  const events = context.phaseManager.getEvents();
  // 只替换本实例公开读取端口：真实角色阶段与工厂共用这条事件流，读取仍返回脱离副本。
  // 不推进整局、不依赖 100ms 定时器，也不触碰 PhaseManager 的私有事件字段。
  Object.defineProperty(context.phaseManager, "getEvents", {
    value: () => structuredClone(events),
  });
  const { trace, liveEvents } = recordingEntry(context),
    initial = trace.build(),
    factory = new GameActionRequestFactory(context.world, events, 1);
  await executeNightStage(HYBRID_STAGE)(
    nightStageContext({
      world: context.world,
      events,
      getAliveByRole: (role) => (role === Role.Hybrid ? [1] : []),
      makeRequest: (actorId, allowedTools, extra) => {
        // 与 NightPipeline 相同：构造选项先拆出，严格 context 只接收真正机制数据。
        const { stage, requiresAction = true, ...extraContext } = extra;
        return factory.create({
          actorId,
          allowedTools,
          phase: Phase.Night,
          stage,
          requiresAction,
          summary: "Offline",
          context: extraContext,
        });
      },
      actionProvider: {
        getAction: (request) =>
          trace.decide(request, {
            getAction: async () => ({ name: "choose_exemplar", args: { target_id: 2 } }),
          }),
      },
    }),
  );
  await trace.decide(
    factory.create({
      actorId: 1,
      allowedTools: ["speak"],
      phase: Phase.Day,
      stage: "day_speech",
      requiresAction: true,
      summary: "Offline",
    }),
    { getAction: async () => ({ name: "speak", args: { text: "Public speech" } }) },
  );
  // 没有追加 checkpoint；build 自己必须捕获当前事实，不能靠后补 checkpoint 掩盖接线缺失。
  const record = trace.build(),
    visible = record.decisions[1]!.request.context.visible_events;
  expect(typeof liveEvents).toBe("function");
  expect(record.checkpoints).toEqual(initial.checkpoints);
  expect(record.events.filter((event) => event.type.startsWith("hybrid_"))).toEqual([
    {
      timestamp: expect.any(Number),
      type: "hybrid_exemplar_chosen",
      payload: { actorId: 1, day: 1, targetId: 2 },
    },
    {
      timestamp: expect.any(Number),
      type: "hybrid_affiliation_resolved",
      payload: { actorId: 1, day: 1, targetId: 2, faction: Camp.Wolf },
    },
  ]);
  expect(visible.filter((event) => event.type === "hybrid_exemplar_chosen")).toEqual([
    {
      seq: expect.any(Number),
      type: "hybrid_exemplar_chosen",
      payload: { actorId: 1, day: 1, targetId: 2 },
    },
  ]);
  expect(visible.some((event) => event.type === "hybrid_affiliation_resolved")).toBe(false);
  expect(context.world.getComponent(1, COMPONENT.Victory)!.affiliations).toEqual([
    { kind: "faction", faction: Camp.Wolf },
  ]);
  expect(trace.settlementCount).toBe(2);
  const wrongTarget = structuredClone(record);
  wrongTarget.decisions[1]!.request.context.visible_events.find(
    (event) => event.type === "hybrid_exemplar_chosen",
  )!.payload.targetId = 3;
  expect(() => validateHybridRecord(wrongTarget)).toThrow("reproduction_hybrid_state_invalid");
  const hidden = structuredClone(record);
  hidden.decisions[1]!.request.context.visible_events.push({
    seq: visible.length + 1,
    type: "hybrid_affiliation_resolved",
    payload: { actorId: 1, day: 1, targetId: 2, faction: Camp.Wolf },
  });
  expect(() => validateHybridRecord(hidden)).toThrow("reproduction_hybrid_state_invalid");
  const chosen = record.events.find((event) => event.type === "hybrid_exemplar_chosen")!;
  chosen.payload.targetId = 6;
  expect(
    trace.build().events.find((event) => event.type === "hybrid_exemplar_chosen")!.payload,
  ).toEqual({ actorId: 1, day: 1, targetId: 2 });
  expect(events.find((event) => event.type === "hybrid_exemplar_chosen")!.payload).toEqual({
    actorId: 1,
    day: 1,
    targetId: 2,
  });
});

test("ordinary beginGame wiring keeps its checkpoint-only event callback selection", () => {
  const context = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Villager, Role.Villager, Role.Seer, Role.Guard],
  });
  const { trace, liveEvents } = recordingEntry(context);
  expect(liveEvents).toBeUndefined();
  expect(trace.build().checkpoints).toHaveLength(1);
});

test("Cupid beginGame wiring includes pre-checkpoint private facts without exposing them to other players", async () => {
  const roles = [Role.Cupid, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Villager];
  const context = bootstrapGame(
    {
      ...sixPlayerMvpConfig,
      roleSetups: [...new Set(roles)].map((role) => ({
        role,
        count: roles.filter((value) => value === role).length,
      })),
      winConditions: [WinCondition.SlaughterCity],
      cupid: { policy: "netease_2017_cupid_follows_lovers_v1" },
    },
    { fixedRoles: roles, locale: "en" },
  );
  const events = context.phaseManager.getEvents();
  // 真实阶段写入这条流；公开读取端口仍逐次复制，不给 Trace 手工补传读取回调。
  Object.defineProperty(context.phaseManager, "getEvents", {
    value: () => structuredClone(events),
  });
  const { trace, liveEvents } = recordingEntry(context),
    initial = trace.build(),
    factory = new GameActionRequestFactory(context.world, events, 1);
  await executeNightStage(CUPID_STAGE)(
    nightStageContext({
      world: context.world,
      events,
      getAliveByRole: (role) => (role === Role.Cupid ? [1] : []),
      makeRequest: (actorId, allowedTools, extra) => {
        const { stage, requiresAction = true, ...extraContext } = extra;
        return factory.create({
          actorId,
          allowedTools,
          phase: Phase.Night,
          stage,
          requiresAction,
          summary: "Offline",
          context: extraContext,
        });
      },
      actionProvider: {
        getAction: (request) =>
          trace.decide(request, {
            getAction: async () => ({ name: "choose_lovers", args: { first_id: 2, second_id: 4 } }),
          }),
      },
    }),
  );
  // 同一 CP0 后分别创建恋人和非恋人请求；不能通过新增 checkpoint 绕过原刷盘窗口。
  for (const actorId of [2, 6])
    await trace.decide(
      factory.create({
        actorId,
        allowedTools: ["speak"],
        phase: Phase.Day,
        stage: "day_speech",
        requiresAction: true,
        summary: "Offline",
      }),
      { getAction: async () => ({ name: "speak", args: { text: "Public speech" } }) },
    );
  const record = trace.build(),
    loverVisible = record.decisions[1]!.request.context.visible_events,
    otherVisible = record.decisions[2]!.request.context.visible_events,
    family = new Set([
      "cupid_lovers_chosen",
      "lover_recognized",
      "cupid_relation_resolved",
      "lovers_death",
    ]);
  expect(typeof liveEvents).toBe("function");
  expect(record.checkpoints).toEqual(initial.checkpoints);
  expect(record.events.filter((event) => family.has(event.type))).toEqual([
    {
      timestamp: expect.any(Number),
      type: "cupid_lovers_chosen",
      payload: { actorId: 1, day: 1, pairIds: [2, 4] },
    },
    {
      timestamp: expect.any(Number),
      type: "lover_recognized",
      payload: { actorId: 2, partnerId: 4 },
    },
    {
      timestamp: expect.any(Number),
      type: "lover_recognized",
      payload: { actorId: 4, partnerId: 2 },
    },
    {
      timestamp: expect.any(Number),
      type: "cupid_relation_resolved",
      payload: {
        actorId: 1,
        day: 1,
        policy: "netease_2017_cupid_follows_lovers_v1",
        pairIds: [2, 4],
        pairCamps: [Camp.Wolf, Camp.Good],
        groupId: "cupid_lovers",
        mixed: true,
      },
    },
  ]);
  expect(loverVisible.filter((event) => family.has(event.type))).toEqual([
    { seq: expect.any(Number), type: "lover_recognized", payload: { actorId: 2, partnerId: 4 } },
  ]);
  expect(otherVisible.filter((event) => family.has(event.type))).toEqual([]);
  expect(context.world.getComponent(2, COMPONENT.Victory)!.affiliations).toEqual([
    { kind: "relationship", groupId: "cupid_lovers" },
  ]);
  expect(trace.settlementCount).toBe(3);
  const wrongPartner = structuredClone(record);
  wrongPartner.decisions[1]!.request.context.visible_events.find(
    (event) => event.type === "lover_recognized",
  )!.payload.partnerId = 3;
  expect(() => validateCupidRecord(wrongPartner)).toThrow("reproduction_cupid_state_invalid");
  const leaked = structuredClone(record);
  leaked.decisions[2]!.request.context.visible_events.push({
    seq: otherVisible.length + 1,
    type: "lover_recognized",
    payload: { actorId: 2, partnerId: 4 },
  });
  expect(() => validateCupidRecord(leaked)).toThrow("reproduction_cupid_state_invalid");
});
