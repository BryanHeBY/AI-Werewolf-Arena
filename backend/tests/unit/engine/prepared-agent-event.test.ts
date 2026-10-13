/**
 * 单元测试覆盖 canonical 家族事实、历史受众与来源裁剪的迁移准备入口。
 * 全部合法/畸形输入和输出字面量独立书写；每个实际读器都有一个完整事实，未从生产结果生成预期。
 * 只使用显式声明为 inert 的内存 fixture，不运行对局或模型；未知宿主对象仍由 Node ingress 拒绝。
 * 验证可信自定义回调保留原参数/receiver/时点，但不能改写已解析 schema 的授权及输出依据。
 */
import { expect, test } from "bun:test";
import {
  type GameEvent,
  type EventPayloadMap,
  Phase,
  Role,
  Camp,
} from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { AgentEventVisibilityRegistry } from "../../../src/game/mechanisms/broadcast/agent_event_visibility_registry";
import {
  prepareInertAgentEvent,
  type InertAgentEvent,
  type AgentEventFactReader,
  type PreparedAgentEvent,
} from "../../../src/game/observation/agent-event-facts";
import {
  canViewPreparedAgentEvent,
  projectPreparedAgentEvent,
} from "../../../src/game/observation/agent-event-projection";
import { projectAbilitySource } from "../../../src/game/mechanisms/roles/abilities";

const queries = {
  demonHunterActorId() {
    return 1;
  },
  custom() {
    return { handled: false } as const;
  },
};
const project = (prepared: PreparedAgentEvent, actorId = 1) =>
  projectPreparedAgentEvent(prepared, actorId, 4, {
    canView(prepared, actorId) {
      return canViewPreparedAgentEvent(prepared, actorId, queries);
    },
    projectAbilitySource(origin, disclosed) {
      return projectAbilitySource(origin(), disclosed());
    },
  });
const cases: Array<{
  event: GameEvent;
  reader: AgentEventFactReader;
  public: boolean;
  expected: Record<string, unknown>;
}> = [
  {
    event: {
      timestamp: 1,
      type: "animal_fox_chosen",
      payload: { policy: "awa_animal_dream_v1", day: 2, actorId: 1, targetId: 2 },
      audience: [1],
    },
    reader: "readAnimalDreamFact",
    public: false,
    expected: { policy: "awa_animal_dream_v1", day: 2, actorId: 1, targetId: 2 },
  },
  {
    event: {
      timestamp: 1,
      type: "fragrant_pair_chosen",
      payload: { policy: "awa_fragrant_pair_seer_v1", actorId: 1, day: 1, pairIds: null },
      audience: [1],
    },
    reader: "readFragrantPairFact",
    public: false,
    expected: { policy: "awa_fragrant_pair_seer_v1", actorId: 1, day: 1, pairIds: null },
  },
  {
    event: {
      timestamp: 1,
      type: "secret_body_chosen",
      payload: { policy: "awa_noble_secret_body_v1", actorId: 1, day: 1, targetId: null },
      audience: [1],
    },
    reader: "readNobleSecretBodyFact",
    public: false,
    expected: { policy: "awa_noble_secret_body_v1", actorId: 1, day: 1, targetId: null },
  },
  {
    event: {
      timestamp: 1,
      type: "eclipse_native_suppressed",
      payload: { playerId: 1, day: 2 },
      audience: [1],
    },
    reader: "readRadiantEclipseFact",
    public: false,
    expected: { playerId: 1, day: 2 },
  },
  {
    event: {
      timestamp: 1,
      type: "mist_knife_drawn",
      payload: { day: 1, candidates: [2, 3], targetId: 2 },
      audience: [1],
    },
    reader: "readMistRavenFact",
    public: false,
    expected: { day: 1, candidates: [2, 3], targetId: 2 },
  },
  {
    event: {
      timestamp: 1,
      type: "wolf_sorcerer_exchange_committed",
      payload: { actorId: 1, day: 1, pair: null },
      audience: [1],
    },
    reader: "readWolfSorcererExchangeFact",
    public: false,
    expected: { actorId: 1, day: 1, pair: null },
  },
  {
    event: {
      timestamp: 1,
      type: "wolf_sorcerer_exchange_skipped",
      payload: { actorId: 1, day: 1, reason: "not_started" },
      audience: [1],
    },
    reader: "readWolfSorcererSkipFact",
    public: false,
    expected: { actorId: 1, day: 1, reason: "not_started" },
  },
  {
    event: {
      timestamp: 1,
      type: "trickster_exchange_committed",
      payload: { actorId: 1, day: 1, pair: null },
      audience: [1],
    },
    reader: "readTricksterExchangeFact",
    public: false,
    expected: { actorId: 1, day: 1, pair: null },
  },
  {
    event: {
      timestamp: 1,
      type: "trickster_exchange_skipped",
      payload: { actorId: 1, day: 1, reason: "exhausted" },
      audience: [1],
    },
    reader: "readTricksterSkipFact",
    public: false,
    expected: { actorId: 1, day: 1, reason: "exhausted" },
  },
  {
    event: {
      timestamp: 1,
      type: "exile_target_mapped",
      payload: { requestedId: 2, effectiveId: 3, missed: true },
    },
    reader: "readExileMappingFact",
    public: true,
    expected: { requestedId: 2, effectiveId: 3, missed: true },
  },
  {
    event: {
      timestamp: 1,
      type: "order_prince_choice_committed",
      payload: { actorId: 1, day: 1, activate: false },
      audience: [1],
    },
    reader: "readOrderPrinceChoiceFact",
    public: false,
    expected: { actorId: 1, day: 1, activate: false },
  },
  {
    event: { timestamp: 1, type: "order_prince_revote_started", payload: { actorId: 1 } },
    reader: "readOrderPrinceRevoteFact",
    public: true,
    expected: { actorId: 1 },
  },
  {
    event: {
      timestamp: 1,
      type: "magician_exchange_committed",
      payload: { actorId: 1, day: 1, pair: [2, 3] },
      audience: [1],
    },
    reader: "readMagicianExchangeFact",
    public: false,
    expected: { day: 1, pair: [2, 3] },
  },
  {
    event: {
      timestamp: 1,
      type: "death_shot_missed",
      payload: { actorId: 1, reason: "no_effect" },
    },
    reader: "readDeathShotMissFact",
    public: true,
    expected: { actorId: 1, reason: "no_effect" },
  },
  {
    event: {
      timestamp: 1,
      type: "red_moon_night_sealed",
      payload: { actorId: 1, day: 1, night: 2 },
    },
    reader: "readRedMoonNextNightFact",
    public: true,
    expected: { actorId: 1, day: 1, night: 2 },
  },
  {
    event: { timestamp: 1, type: "red_moon_delay_expired", payload: { actorId: 1, day: 1 } },
    reader: "readRedMoonExpiryFact",
    public: true,
    expected: { actorId: 1, day: 1 },
  },
  {
    event: {
      timestamp: 1,
      type: "nightmare_fear_committed",
      payload: { actorId: 1, day: 1, targetId: 2 },
      audience: [1],
    },
    reader: "readNightmareFearFact",
    public: false,
    expected: { day: 1, targetId: 2 },
  },
  {
    event: {
      timestamp: 1,
      type: "demon_hunter_chosen",
      payload: { policy: "awa_netease_demon_hunter_v1", actorId: 1, day: 2, targetId: 2 },
      audience: [1],
    },
    reader: "readDemonHunterEventFact",
    public: false,
    expected: { policy: "awa_netease_demon_hunter_v1", day: 2, targetId: 2 },
  },
  {
    event: {
      timestamp: 1,
      type: "ghost_bride_partner_chat",
      payload: {
        policy: "awa_melbourne_ghost_bride_v1",
        groupId: "ghost-bride:1:1",
        day: 1,
        actorId: 1,
        recipientId: 2,
        text: "原文\nraw 🐺",
      },
      audience: [1],
    },
    reader: "readGhostBrideEventFact",
    public: false,
    expected: {
      policy: "awa_melbourne_ghost_bride_v1",
      groupId: "ghost-bride:1:1",
      day: 1,
      actorId: 1,
      recipientId: 2,
      text: "原文\nraw 🐺",
    },
  },
  {
    event: {
      timestamp: 1,
      type: "lonely_girl_admired_chosen",
      payload: {
        policy: "awa_netease_lonely_girl_v1",
        actorId: 1,
        day: 1,
        targetId: 2,
        camp: Camp.Wolf,
      },
    },
    reader: "readLonelyGirlEventFact",
    public: false,
    expected: { policy: "awa_netease_lonely_girl_v1", actorId: 1, day: 1, targetId: 2 },
  },
  {
    event: {
      timestamp: 1,
      type: "wild_child_model_chosen",
      payload: { actorId: 1, day: 1, targetId: 2 },
    },
    reader: "readWildChildEventFact",
    public: false,
    expected: { actorId: 1, day: 1, targetId: 2 },
  },
  {
    event: {
      timestamp: 1,
      type: "shapeshifter_identity_chosen",
      payload: {
        policy: "awa_netease_shapeshifter_two_extra_villagers_v1",
        actorId: 1,
        day: 1,
        slot: 0,
        role: Role.Villager,
        camp: Camp.Good,
      },
    },
    reader: "readShapeshifterEventFact",
    public: false,
    expected: {
      policy: "awa_netease_shapeshifter_two_extra_villagers_v1",
      actorId: 1,
      day: 1,
      slot: 0,
      role: Role.Villager,
      camp: Camp.Good,
    },
  },
  {
    event: {
      timestamp: 1,
      type: "thief_identity_chosen",
      payload: {
        policy: "lui_meme_thief_two_extra_villagers_v1",
        actorId: 1,
        day: 1,
        slot: 1,
        role: Role.Villager,
        camp: Camp.Good,
      },
    },
    reader: "readThiefEventFact",
    public: false,
    expected: {
      policy: "lui_meme_thief_two_extra_villagers_v1",
      actorId: 1,
      day: 1,
      slot: 1,
      role: Role.Villager,
      camp: Camp.Good,
    },
  },
  {
    event: {
      timestamp: 1,
      type: "wall_notes_started",
      payload: { day: 1, eventId: "awa_wall_notes_v1" },
    },
    reader: "readWallEventFact",
    public: true,
    expected: { day: 1, eventId: "awa_wall_notes_v1" },
  },
  {
    event: {
      timestamp: 1,
      type: "cupid_lovers_chosen",
      payload: { actorId: 1, day: 1, pairIds: [2, 3] },
    },
    reader: "readCupidEventFact",
    public: false,
    expected: { actorId: 1, day: 1, pairIds: [2, 3] },
  },
  {
    event: {
      timestamp: 1,
      type: "debate_speech",
      payload: { actorId: 1, text: "原文\nraw <tag> 😀" },
    },
    reader: "readDebateEventFact",
    public: true,
    expected: { actorId: 1, text: "原文\nraw <tag> 😀" },
  },
  {
    event: {
      timestamp: 1,
      type: "modifier_choice_committed",
      payload: { actorId: 1, day: 2, mode: null, targetId: null },
      audience: [1],
    },
    reader: "readModifierChoiceFact",
    public: false,
    expected: { actorId: 1, day: 2, mode: null, targetId: null },
  },
  {
    event: {
      timestamp: 1,
      type: "modifier_choice_skipped",
      payload: { actorId: 1, day: 1, reason: "first_night" },
      audience: [1],
    },
    reader: "readModifierSkipFact",
    public: false,
    expected: { actorId: 1, day: 1, reason: "first_night" },
  },
  {
    event: {
      timestamp: 1,
      type: "modifier_bonus_resolved",
      payload: { actorId: 1, day: 2, kind: "guard", targetId: null, abstain: true },
      audience: [1],
    },
    reader: "readModifierBonusFact",
    public: false,
    expected: { actorId: 1, day: 2, kind: "guard", targetId: null, abstain: true },
  },
  {
    event: {
      timestamp: 1,
      type: "time_consort_lock_committed",
      payload: { actorId: 1, day: 1, targetId: null },
      audience: [1],
    },
    reader: "readTimeConsortChoiceFact",
    public: false,
    expected: { actorId: 1, day: 1, targetId: null },
  },
  {
    event: {
      timestamp: 1,
      type: "time_consort_lock_skipped",
      payload: { actorId: 1, day: 1, reason: "dead" },
      audience: [1],
    },
    reader: "readTimeConsortSkipFact",
    public: false,
    expected: { actorId: 1, day: 1, reason: "dead" },
  },
];

test("all fact readers use the same parsed family for authorization, exact fields and bad-tail rejection", () => {
  for (const row of cases) {
    // 只给手写纯字面量附加编译期标记；不会给未知对象增加 runtime 信任。
    const prepared = prepareInertAgentEvent(row.event as InertAgentEvent);
    expect(prepared.fact?.reader).toBe(row.reader);
    expect(project(prepared)).toEqual({ seq: 4, type: row.event.type, payload: row.expected });
    expect(project(prepared, 9)).toEqual(
      row.public ? { seq: 4, type: row.event.type, payload: row.expected } : null,
    );
    const invalid = {
      ...row.event,
      payload: { ...row.event.payload, hiddenTarget: 99 },
    } as unknown as InertAgentEvent;
    const rejected = prepareInertAgentEvent(invalid);
    expect(rejected.fact).toBeNull();
    expect(project(rejected)).toBeNull();
  }
});

test("schema projection and actor permission retain the one parsed fact after trusted mutation", () => {
  const event: GameEvent = {
    timestamp: 1,
    type: "nightmare_fear_committed",
    audience: [1],
    payload: { actorId: 1, day: 1, targetId: 2 },
  };
  const prepared = prepareInertAgentEvent(event as InertAgentEvent);
  const originalFact = prepared.fact;
  // 可信入口的调用者改变旧对象，不得使授权 actor 与输出 target 跨两次解析产生矛盾。
  Object.defineProperty(event.payload, "actorId", {
    enumerable: true,
    get() {
      throw Error("must_not_reparse_actor");
    },
  });
  Object.defineProperty(event.payload, "targetId", {
    enumerable: true,
    get() {
      throw Error("must_not_reparse_target");
    },
  });
  expect(project(prepared)).toEqual({
    seq: 4,
    type: "nightmare_fear_committed",
    payload: { day: 1, targetId: 2 },
  });
  expect(project(prepared, 9)).toBeNull();
  expect(prepared.fact).toBe(originalFact);
});

test("trusted schema custom callback preserves receiver and original copy while canonical output stays valid", () => {
  const world = new World(),
    trace: string[] = [];
  const event: GameEvent = {
    timestamp: 1,
    type: "red_moon_night_sealed",
    payload: { actorId: 1, day: 2, night: 3 },
  };
  const prepared = prepareInertAgentEvent(event as InertAgentEvent);
  const registry = new AgentEventVisibilityRegistry({
    get red_moon_night_sealed() {
      trace.push("lookup");
      return function (
        this: unknown,
        observedWorld: World,
        observedEvent: GameEvent,
        actorId: number,
      ) {
        trace.push("callback");
        expect(this).toBeUndefined();
        expect(observedWorld).toBe(world);
        expect(observedEvent).toBe(event);
        expect(actorId).toBe(1);
        if (observedEvent.type === "red_moon_night_sealed") observedEvent.payload.day = 9;
        return true;
      };
    },
  });
  const actual = projectPreparedAgentEvent(prepared, 1, 4, {
    canView(prepared, actorId) {
      return registry.canViewPrepared(world, prepared, actorId);
    },
    projectAbilitySource() {
      throw Error("source_unused");
    },
  });
  expect(trace).toEqual(["lookup", "callback"]);
  expect(actual).toEqual({
    seq: 4,
    type: "red_moon_night_sealed",
    payload: { actorId: 1, day: 2, night: 3 },
  });
  expect(event.payload.day).toBe(9);
});

test("non-schema trusted source callback stays after visibility and preserves callee then source reads", () => {
  const trace: string[] = [];
  const event: GameEvent = {
    timestamp: 1,
    type: "ability_changed",
    payload: {
      actorId: 1,
      abilityId: "native:seer_check",
      kind: "seer_check",
      operation: "granted",
      source: { kind: "native", role: Role.Seer },
      sourceDisclosed: true,
      startsOnDay: 1,
      maxUses: null,
    },
  };
  const prepared = prepareInertAgentEvent(event as InertAgentEvent);
  const actual = projectPreparedAgentEvent(prepared, 1, 1, {
    canView(observed) {
      expect(observed.sourceEvent).toBe(event as InertAgentEvent);
      trace.push("visibility");
      Object.defineProperty(event.payload, "source", {
        enumerable: true,
        get() {
          trace.push("source");
          return { kind: "native", role: Role.Seer };
        },
      });
      Object.defineProperty(event.payload, "sourceDisclosed", {
        enumerable: true,
        get() {
          trace.push("disclosed");
          return false;
        },
      });
      return true;
    },
    get projectAbilitySource() {
      trace.push("callee");
      return (
        origin: () => EventPayloadMap["ability_changed"]["source"],
        disclosed: () => boolean,
      ) => projectAbilitySource(origin(), disclosed());
    },
  });
  expect(trace).toEqual(["visibility", "callee", "source", "disclosed"]);
  expect(actual?.payload.source).toEqual({ kind: "native" });
});

test("unknown events deny by default while ordinary public facts keep their literal text", () => {
  expect(
    project(
      prepareInertAgentEvent({
        timestamp: 1,
        type: "new_hidden_fact",
        payload: { secret: 42 },
      } as unknown as InertAgentEvent),
    ),
  ).toBeNull();
  expect(
    project(
      prepareInertAgentEvent({
        timestamp: 1,
        type: "day_speech",
        payload: { actorId: 2, text: "原文\nraw <tag> 😀" },
      } as InertAgentEvent),
    ),
  ).toEqual({ seq: 4, type: "day_speech", payload: { actorId: 2, text: "原文\nraw <tag> 😀" } });
  expect(
    project(
      prepareInertAgentEvent({
        timestamp: 1,
        type: "phase_changed",
        payload: { phase: Phase.Day, day: 1 },
      } as InertAgentEvent),
    ),
  ).toEqual({ seq: 4, type: "phase_changed", payload: { phase: Phase.Day, day: 1 } });
});

test("prepared permission uses the strict feed audience boundary without changing legacy boolean policy", () => {
  const world = new World(),
    registry = new AgentEventVisibilityRegistry();
  const event: GameEvent = {
    timestamp: 1,
    type: "mist_knife_drawn",
    audience: [1, 1],
    payload: { day: 1, candidates: [2], targetId: 2 },
  };
  expect(registry.canView(world, event, 1)).toBe(true);
  expect(registry.canViewPrepared(world, prepareInertAgentEvent(event as InertAgentEvent), 1)).toBe(
    false,
  );
});

test("prepared schema keeps its rule key and payload across actors after trusted type and getter mutation", () => {
  const world = new World(),
    trace: string[] = [];
  const event: GameEvent = {
    timestamp: 1,
    type: "red_moon_night_sealed",
    payload: { actorId: 1, day: 2, night: 3 },
  };
  const prepared = prepareInertAgentEvent(event as InertAgentEvent);
  const registry = new AgentEventVisibilityRegistry({
    get red_moon_night_sealed() {
      trace.push("lookup");
      return function (
        this: unknown,
        observedWorld: World,
        observedEvent: GameEvent,
        actorId: number,
      ) {
        expect(this).toBeUndefined();
        expect(observedWorld).toBe(world);
        expect(observedEvent).toBe(event);
        trace.push(`callback:${actorId}`);
        if (actorId === 1) {
          // 这是支持的可信规则副作用，不模拟 Node ingress 接受未知 getter。
          Object.defineProperty(observedEvent, "type", {
            enumerable: true,
            value: "phase_changed",
          });
          Object.defineProperty(observedEvent, "payload", {
            enumerable: true,
            get() {
              trace.push("payload");
              throw Error("source_payload_must_not_be_reparsed");
            },
          });
        }
        return actorId !== 2;
      };
    },
  });
  const render = (actorId: number) =>
    projectPreparedAgentEvent(prepared, actorId, 5, {
      canView(prepared, actorId) {
        return registry.canViewPrepared(world, prepared, actorId);
      },
      projectAbilitySource() {
        throw Error("source_unused");
      },
    });
  expect(render(1)).toEqual({
    seq: 5,
    type: "red_moon_night_sealed",
    payload: { actorId: 1, day: 2, night: 3 },
  });
  expect(render(2)).toBeNull();
  expect(render(3)).toEqual({
    seq: 5,
    type: "red_moon_night_sealed",
    payload: { actorId: 1, day: 2, night: 3 },
  });
  expect(trace).toEqual(["lookup", "callback:1", "lookup", "callback:2", "lookup", "callback:3"]);
});

test("prepared schema owns historical audience independently of in-place source mutation", () => {
  const event: GameEvent & { audience: number[] } = {
    timestamp: 1,
    type: "mist_knife_drawn",
    audience: [1],
    payload: { day: 1, candidates: [2, 3], targetId: 2 },
  };
  // 只断言手写内存 fixture；生产入口必须先实际验证并复制，类型标记本身不授予安全或行动权限。
  const prepared = prepareInertAgentEvent(event as unknown as InertAgentEvent);
  // 此家族先于 custom 返回；这里模拟调用者在两次玩家查询之间改变 source，而不是虚构家族 custom 分支。
  event.audience[0] = 9;
  event.audience.push(10);
  expect(project(prepared, 1)).toEqual({
    seq: 4,
    type: "mist_knife_drawn",
    payload: { day: 1, candidates: [2, 3], targetId: 2 },
  });
  expect(project(prepared, 9)).toBeNull();
  expect(project(prepared, 10)).toBeNull();
  expect(prepared.projectionEvent).not.toBe(event);
  expect("audience" in prepared.projectionEvent && prepared.projectionEvent.audience).toEqual([1]);
});

test("prepared schema owns nested fact arrays after an actual public custom callback changes source text", () => {
  const world = new World();
  const event: GameEvent = {
    timestamp: 1,
    type: "wall_notes_published",
    payload: { day: 1, eventId: "awa_wall_notes_v1", texts: ["原文 🐺", "raw <tag>"] },
  };
  const prepared = prepareInertAgentEvent(event as InertAgentEvent);
  const registry = new AgentEventVisibilityRegistry({
    wall_notes_published(_world, observedEvent) {
      if (observedEvent.type === "wall_notes_published") {
        observedEvent.payload.texts[0] = "被修改";
        observedEvent.payload.texts.push("额外秘密");
      }
      return true;
    },
  });
  const render = (actorId: number) =>
    projectPreparedAgentEvent(prepared, actorId, 6, {
      canView(prepared, actorId) {
        return registry.canViewPrepared(world, prepared, actorId);
      },
      projectAbilitySource() {
        throw Error("source_unused");
      },
    });
  expect(render(1)).toEqual({
    seq: 6,
    type: "wall_notes_published",
    payload: { day: 1, eventId: "awa_wall_notes_v1", texts: ["原文 🐺", "raw <tag>"] },
  });
  expect(render(2)).toEqual({
    seq: 6,
    type: "wall_notes_published",
    payload: { day: 1, eventId: "awa_wall_notes_v1", texts: ["原文 🐺", "raw <tag>"] },
  });
  expect(event.payload.texts).toEqual(["被修改", "raw <tag>", "额外秘密", "额外秘密"]);
});

test("prepared schema detaches every original family reader payload before any later source mutation", () => {
  const changeSource = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) changeSource(child);
      value.splice(0, value.length, "changed-source-array");
    } else if (value && typeof value === "object") {
      for (const key of Object.keys(value)) {
        const child: unknown = Reflect.get(value, key);
        if (child && typeof child === "object") changeSource(child);
        else Reflect.set(value, key, "changed-source-field");
      }
    }
  };
  for (const row of cases) {
    const event = structuredClone(row.event);
    const prepared = prepareInertAgentEvent(event as InertAgentEvent);
    changeSource(event.payload);
    expect(prepared.fact?.reader).toBe(row.reader);
    expect(project(prepared)).toEqual({ seq: 4, type: row.event.type, payload: row.expected });
  }
});
