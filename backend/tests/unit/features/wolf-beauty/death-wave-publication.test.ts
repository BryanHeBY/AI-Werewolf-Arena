/**
 * 单元测试验证狼美人完整死亡波贡献的来源短路、先领取后保护和标死后发布失败前缀。
 * 输入为真实原体／绑定、手写死因与运行 getter；输出以独立 trace、原引用及 resolved/applied 验收。
 * 仅驱动有限准备／发布，不运行整局或模型；事件失败不能退款，字段契约不是死亡许可。
 */
import { bindDreamLifeQueries } from "../../../../src/domain/dream-night-effects";
import { expect, test } from "bun:test";
import {
  Camp,
  Role,
  DeathCause,
  type GameEvent,
  type DeathSources,
} from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";
import type { DreamNightEffects } from "../../../../src/domain/dream-night-effects";
import {
  createWolfBeautyDeathContribution,
  bindWolfBeautyDeathCommands,
  type WolfBeautyDeathCommands,
  attemptCharmTrigger,
  commitCharmDeath,
  setWolfBeautyState,
} from "../../../../src/features/wolf-beauty/ports";
import { bindCharm, activeCharm } from "../../../../src/features/wolf-beauty/relation";

function fixture() {
  const world = new World("en"),
    actor = world.createEntity(),
    target = world.createEntity();
  const role = createRoleComponent(Role.WolfBeauty);
  setWolfBeautyState(role, {
    targetId: target,
    lastActedDay: 1,
    history: [],
    deathLinkPolicy: "awa_exile_poison_v1",
  });
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Camp, { camp: Camp.Wolf });
  world.addComponent(target, COMPONENT.Role, createRoleComponent(Role.Villager));
  world.addComponent(target, COMPONENT.Camp, { camp: Camp.Good });
  const actorLife = createAliveComponent(),
    targetLife = createAliveComponent();
  world.addComponent(actor, COMPONENT.Alive, actorLife);
  world.addComponent(target, COMPONENT.Alive, targetLife);
  bindCharm(world, actor, target);
  const binding = activeCharm(world, actor)!;
  actorLife.alive = false;
  return { world, actor, target, binding, targetLife };
}

test("a suppressed source refuses before runtime World, protection or publication reads", () => {
  const f = fixture(),
    proposed: number[] = [],
    sources: DeathSources = {},
    nightTargets: number[] = [];
  const owner = createWolfBeautyDeathContribution(
    [{ binding: f.binding, nightEffect: true }],
    bindWolfBeautyDeathCommands({
      world: f.world,
      events: [],
      prepareWorld() {
        throw new Error("world_must_not_read");
      },
      prepareEvents() {
        throw new Error("events_must_not_read");
      },
    }),
  );
  const triggers = owner.prepare(
    {
      blocksNightLinkedDeath() {
        throw new Error("dreams_must_not_read");
      },
    },
    proposed,
    sources,
    nightTargets,
    { [f.actor]: [DeathCause.Poison, DeathCause.Dream] },
    new Set(),
    new Set([f.actor]),
  );
  expect(triggers.linkedDeaths).toEqual([]);
  expect(proposed).toEqual([]);
  expect(sources).toEqual({});
  expect(nightTargets).toEqual([]);
  expect(f.binding.resolved).toBe(false);
});

test("blocked publication failure keeps the paid claim and original receiver/read prefix", () => {
  const f = fixture(),
    trace: string[] = [],
    failure = new Error("blocked_publication_failed");
  const proposed: number[] = [],
    sources: DeathSources = {},
    nightTargets: number[] = [],
    seen = new Set([f.actor]);
  const dreams: Pick<DreamNightEffects, "blocksNightCharm"> = {
    get blocksNightCharm(): DreamNightEffects["blocksNightCharm"] {
      trace.push("method");
      return function (this: typeof dreams, world, targetId, originalSeen) {
        trace.push("block");
        expect(this).toBe(dreams);
        expect(world.matchesAlive(f.target, () => f.targetLife)).toBe(true);
        expect(targetId).toBe(f.target);
        expect(originalSeen).toBe(seen);
        expect(f.binding.resolved).toBe(true);
        return true;
      };
    },
  };
  const privateSource = {
    get world() {
      trace.push("world");
      return f.world;
    },
    get events(): GameEvent[] {
      trace.push("events");
      throw failure;
    },
  };
  const bound = bindWolfBeautyDeathCommands({
    world: f.world,
    events: [],
    prepareWorld: () => privateSource.world,
    prepareEvents: () => privateSource.events,
  });
  const owner = createWolfBeautyDeathContribution([{ binding: f.binding, nightEffect: true }], {
    get attempt() {
      trace.push("attempt");
      const attempt = bound.attempt;
      return function (this: unknown, ...args: Parameters<WolfBeautyDeathCommands["attempt"]>) {
        expect(this).toBeUndefined();
        return attempt(...args);
      };
    },
    get commit() {
      return bound.commit;
    },
    blocked: (binding) => bound.blocked(binding),
    applied: (binding) => bound.applied(binding),
  });
  const nightEffects = {
    get dreams() {
      trace.push("dreams");
      return dreams;
    },
  };
  expect(() =>
    owner.prepare(
      {
        blocksNightLinkedDeath(target) {
          return nightEffects?.dreams?.blocksNightCharm(
            bindDreamLifeQueries(privateSource.world),
            target(),
            seen,
          );
        },
      },
      proposed,
      sources,
      nightTargets,
      { [f.actor]: [DeathCause.Poison] },
      new Set(),
      seen,
    ),
  ).toThrow(failure);
  expect(trace).toEqual(["attempt", "world", "dreams", "method", "world", "block", "events"]);
  expect(f.binding.resolved).toBe(true);
  expect(f.binding.applied).toBe(false);
  expect(f.targetLife.alive).toBe(true);
  expect(proposed).toEqual([]);
  expect(sources).toEqual({});
  expect(nightTargets).toEqual([]);
});

test("claimed preparation preserves container prefixes and applies only after real death even if publishing throws", () => {
  const f = fixture(),
    proposed = [f.target],
    nightTargets: number[] = [],
    failure = new Error("applied_publication_failed");
  const sources: DeathSources = { [f.target]: [DeathCause.Poison, DeathCause.Charm] };
  const owner = createWolfBeautyDeathContribution(
    [{ binding: f.binding, nightEffect: false }],
    bindWolfBeautyDeathCommands({
      world: f.world,
      events: [],
      prepareWorld: () => f.world,
      prepareEvents() {
        throw failure;
      },
    }),
  );
  const triggers = owner.prepare(
    {
      blocksNightLinkedDeath() {
        throw new Error("day_charm_must_not_read_dreams");
      },
    },
    proposed,
    sources,
    nightTargets,
    { [f.actor]: [DeathCause.Exile] },
    new Set(),
    new Set([f.actor]),
  );
  expect(triggers.linkedDeaths).toHaveLength(1);
  expect(triggers.linkedDeaths).toEqual([
    { targetId: f.target, addedCauses: [DeathCause.Charm], publicAdditionalDeath: true },
  ]);
  expect(f.binding.resolved).toBe(true);
  expect(proposed).toEqual([f.target]);
  expect(sources).toEqual({ [f.target]: [DeathCause.Poison, DeathCause.Charm] });
  expect(nightTargets).toEqual([]);
  expect(() => triggers.publishAfterDeaths()).not.toThrow();
  expect(f.binding.applied).toBe(false);
  // 只在真实目标生命转为死亡后发布；事件 getter 抛错仍不能撤销 relation 的已 applied 前缀。
  f.targetLife.alive = false;
  expect(() => triggers.publishAfterDeaths()).toThrow(failure);
  expect(f.binding.applied).toBe(true);
  expect(f.targetLife.alive).toBe(false);
});
