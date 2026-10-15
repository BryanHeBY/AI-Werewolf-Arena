/**
 * 单元测试验证特殊夜同步准备的晚读顺序和已发生故障／必需记录失败前缀。
 * 输入为测试自有 World、原夜对象及明确 fault 端口；字面轨迹、原生命表引用和错误身份为独立预期。
 * 这里只控制准备步骤，不把模拟故障端口或直接调用当成行动授权；不执行模型或完整对局。
 */
import { expect, test } from "bun:test";
import { DeathCause, type ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../src/domain/components/alive";
import type { NightPipelineResult } from "../../../src/engine/phases/night-pipeline";
import type { AppliedFault, FaultDecisionBoundary } from "../../../src/engine/fault-plan";
import { runWithSessionRecorder } from "../../../src/recording/session/context";
import type { SessionRecordManager } from "../../../src/recording/session/recorder";
import {
  prepareSpecialNightDamage,
  type SpecialNightDamageRuntime,
} from "../../../src/rulesets/special-night-damage-preparation";

type Night = Extract<NightPipelineResult, { interrupted: false }>;
const unusedLifecycle = {
  expireNobleAtNightEnd(): never {
    throw new Error("literal_noble_must_not_expire");
  },
  closeNobleNormally(): never {
    throw new Error("literal_noble_must_not_close");
  },
};
function fixture() {
  const world = new World();
  for (let id = 1; id <= 2; id++) {
    expect(world.createEntity()).toBe(id);
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
  }
  return { world, config: {} as ReadonlyBoardConfig };
}

test("可读性首失败不读取故障、World或夜伤害，也不产生新的等待", () => {
  const failure = new Error("literal_initial_night_unreadable"),
    trace: string[] = [];
  const runtime = {
    assertReadable() {
      trace.push("readable");
      throw failure;
    },
    get world(): never {
      throw new Error("literal_world_must_not_read");
    },
    get config(): never {
      throw new Error("literal_config_must_not_read");
    },
    get events(): never {
      throw new Error("literal_events_must_not_read");
    },
    get nightFaultPlan(): never {
      throw new Error("literal_fault_must_not_read");
    },
  };
  const night = {
    get damage(): never {
      throw new Error("literal_damage_must_not_read");
    },
  } as unknown as Night;
  queueMicrotask(() => trace.push("queued"));
  expect(() => prepareSpecialNightDamage(runtime, night, 2, false, false, unusedLifecycle)).toThrow(
    failure,
  );
  expect(trace).toEqual(["readable"]);
});

test("同步故障必需记录失败保已换生命，不继续封存或读取伤害", () => {
  const f = fixture(),
    old = f.world.getComponent(1, COMPONENT.Alive)!,
    replacement = createAliveComponent();
  const failure = new Error("literal_required_fault_record_failed"),
    trace: string[] = [];
  const applied: AppliedFault = {
    step: {
      id: "literal_fault",
      at: {
        day: 2,
        point: "before_night_source_freeze",
        afterDecision: { actorId: 1, stage: "demon_hunter", turn: 1 },
      },
      mutation: { kind: "replace_alive_component", playerId: 1, alive: true },
    },
    originalVersion: aliveLifeVersion(old)!,
    replacementVersion: aliveLifeVersion(replacement)!,
  };
  const plan = {
    get applyBeforeNightSourceFreeze() {
      trace.push("callee");
      return function (
        this: unknown,
        day: number,
        decision: FaultDecisionBoundary | null,
        record: (fault: AppliedFault) => void,
      ): readonly string[] {
        expect(this).toBe(plan);
        expect(day).toBe(2);
        expect(decision).toBeNull();
        trace.push("apply");
        // 仅此测试端口执行明确的原体替换，验证回调失败不退款；生产 fault 资格仍由原驱动检查。
        f.world.addComponent(1, COMPONENT.Alive, replacement);
        record(applied);
        throw new Error("literal_record_should_throw_first");
      };
    },
  };
  const runtime: SpecialNightDamageRuntime = {
    assertReadable() {
      trace.push("readable");
    },
    get nightFaultPlan() {
      trace.push("plan");
      return plan;
    },
    get world() {
      trace.push("world");
      return f.world;
    },
    get config(): never {
      throw new Error("literal_config_must_not_read");
    },
    get events(): never {
      throw new Error("literal_events_must_not_read");
    },
  };
  const recorder = {
    recordRequiredLogicOp() {
      trace.push("required");
      throw failure;
    },
  } as unknown as SessionRecordManager;
  const night = {
    get damage(): never {
      throw new Error("literal_damage_must_not_read");
    },
  } as unknown as Night;
  expect(() =>
    runWithSessionRecorder(recorder, () =>
      prepareSpecialNightDamage(runtime, night, 2, false, false, unusedLifecycle),
    ),
  ).toThrow(failure);
  expect(trace).toEqual(["readable", "plan", "callee", "world", "apply", "required"]);
  expect(f.world.getComponent(1, COMPONENT.Alive)).toBe(replacement);
  expect(old.alive).toBe(true);
});

test("原夜逐目标晚读生命和来源，返回最后原表；空来源不读deathLives", () => {
  const f = fixture(),
    trace: string[] = [];
  const first = new Map(
    [1, 2].map((id) => {
      const life = f.world.getComponent(id, COMPONENT.Alive)!;
      return [id, { life, version: aliveLifeVersion(life) }] as const;
    }),
  );
  const last = new Map(first),
    damage = {
      deaths: [1, 2],
      deathSources: { 1: [DeathCause.PureWhiteInspection], 2: [DeathCause.Poison] },
    };
  let reads = 0;
  const night = {
    interrupted: false as const,
    get damage() {
      trace.push("damage");
      return damage;
    },
    get deathLives() {
      trace.push("lives:" + ++reads);
      return reads === 1 ? first : last;
    },
    get inspectionAttacks() {
      trace.push("inspection");
      return [
        {
          target: first.get(1)!,
          cause: DeathCause.PureWhiteInspection,
          isCurrent() {
            trace.push("current");
            return true;
          },
        },
      ].map((attack) => ({ ...attack, target: { id: 1, ...attack.target } }));
    },
    get retaliationAttacks(): never {
      throw new Error("literal_retaliation_must_not_read");
    },
  } as unknown as Night;
  const runtime: SpecialNightDamageRuntime = {
    assertReadable() {
      trace.push("readable");
    },
    get world() {
      trace.push("world");
      return f.world;
    },
    get config() {
      trace.push("config");
      return f.config;
    },
    get events(): never {
      throw new Error("literal_events_must_not_read");
    },
    get nightFaultPlan() {
      trace.push("plan");
      return undefined;
    },
  };
  const prepared = prepareSpecialNightDamage(runtime, night, 2, false, false, unusedLifecycle);
  expect(trace).toEqual([
    "readable",
    "plan",
    "damage",
    "damage",
    "damage",
    "config",
    "lives:1",
    "world",
    "lives:2",
    "world",
    "inspection",
    "current",
    "config",
    "world",
    "world",
    "world",
  ]);
  expect(prepared.originalLives).toBe(last);
  expect(prepared.sourceDamage).toBe(damage);
  expect(prepared.deaths).toEqual([1, 2]);
  expect(prepared.sources).toEqual({
    1: ["pure_white_inspection"],
    2: ["poison"],
  } as typeof prepared.sources);
  expect(prepared.livingBeforeChain.get(1)!.life).toBe(first.get(1)!.life);
  expect(f.world.getAliveEntityIds()).toEqual([1, 2]);
  const empty = {
    interrupted: false,
    damage: { deaths: [], deathSources: {} },
    get deathLives(): never {
      throw new Error("literal_empty_lives_must_not_read");
    },
  } as unknown as Night;
  expect(
    prepareSpecialNightDamage(runtime, empty, 2, false, false, unusedLifecycle).originalLives,
  ).toBeUndefined();
});
