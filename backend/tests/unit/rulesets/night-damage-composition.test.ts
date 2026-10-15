/**
 * 单元测试验证完整黎明组合的 callee／参数顺序、异常前缀和同一运行梦实例。
 * 输入为原生命、手写 links／claims、可观察 getter 与原伤害对象；输出以字面 trace、字段和引用验收。
 * 不从生产折叠构造预期、不跑整局或模型；替换 enum 描述符仅在测试内 finally 恢复，不新增生产权限。
 */
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../src/domain/components/alive";
import { DeathCause, type GameEvent } from "../../../src/domain/model";
import type { NightDamageEffects } from "../../../src/domain/night-damage-plan";
import type {
  DamageResolutionSystem,
  DamageResolutionResult,
} from "../../../src/domain/systems/damage-resolution-system";
import { DreamNightFrame, type DreamNightLink } from "../../../src/features/dreamer/night-frame";
import { installDreamNightLinks } from "../../../src/features/dreamer/night-links";
import {
  composeNightDamage,
  type NightDamageCompositionRuntime,
} from "../../../src/rulesets/night-damage-composition";

type Claims = ReturnType<NightDamageCompositionRuntime["claims"]>;
type Solver = ReturnType<NightDamageCompositionRuntime["solver"]>;

function runtime(
  world: World,
  claims: Claims,
  solver: Solver,
  trace: string[],
): NightDamageCompositionRuntime {
  return {
    ownsRadiant() {
      trace.push("owns");
      return false;
    },
    world() {
      trace.push("world");
      return world;
    },
    day() {
      trace.push("day");
      return 2;
    },
    claims() {
      trace.push("claims");
      return claims;
    },
    config() {
      trace.push("config");
      return {};
    },
    stageContext() {
      throw new Error("ordinary_context_must_not_read");
    },
    solver() {
      trace.push("solver");
      return solver;
    },
    aliveByRole(role) {
      trace.push("roster");
      role();
      return [];
    },
  };
}

test("a resolve getter failure occurs after frame creation and before World or damage input fields", () => {
  const trace: string[] = [],
    failure = new Error("literal_resolve_getter_failure");
  const claims: Claims = {
    get modifierDeaths(): Claims["modifierDeaths"] {
      throw new Error("input_must_not_form_before_resolve_lookup");
    },
  };
  // 旧通用 getter 不再是关系输入；不能把其读取日志当作本族登记／Frame 构造的证明。
  Object.defineProperty(claims, "dreamLinks", { get() { throw new Error("retired_dream_getter_must_not_read"); } });
  const solver: Solver = {
    get resolve(): DamageResolutionSystem["resolve"] {
      trace.push("resolve:get");
      throw failure;
    },
  };
  expect(() => composeNightDamage(runtime(new World(), claims, solver, trace))).toThrow(failure);
  expect(trace).toEqual(["owns", "claims", "config", "solver", "resolve:get"]);
});

test("a modifier field failure retains the resolve lookup then World and day prefix without invoking the solver", () => {
  const trace: string[] = [],
    failure = new Error("literal_modifier_field_failure");
  const claims: Claims = {
    get modifierDeaths(): Claims["modifierDeaths"] {
      trace.push("modifierDeaths");
      throw failure;
    },
  };
  // 旧通用 getter 不再是关系输入；不能把其读取日志当作本族登记／Frame 构造的证明。
  Object.defineProperty(claims, "dreamLinks", { get() { throw new Error("retired_dream_getter_must_not_read"); } });
  const solver: Solver = {
    get resolve(): DamageResolutionSystem["resolve"] {
      trace.push("resolve:get");
      return () => {
        throw new Error("solver_must_not_run_after_input_failure");
      };
    },
  };
  expect(() => composeNightDamage(runtime(new World(), claims, solver, trace))).toThrow(failure);
  expect(trace).toEqual([
    "owns",
    "claims",
    "config",
    "solver",
    "resolve:get",
    "world",
    "day",
    "claims",
    "modifierDeaths",
  ]);
});

test("the returned frame owns the original reasons and links while solver receiver and roster lookup stay late", () => {
  const world = new World(),
    actor = world.createEntity(),
    target = world.createEntity();
  const actorLife = createAliveComponent(),
    targetLife = createAliveComponent();
  world.addComponent(actor, COMPONENT.Alive, actorLife);
  world.addComponent(target, COMPONENT.Alive, targetLife);
  const links: DreamNightLink[] = [
    {
      actorId: actor,
      targetId: target,
      day: 2,
      abilityId: "literal-dream",
      consecutive: true,
      protectionPolicy: "netease_2026_night_immunity_v1",
      actorLife,
      actorVersion: aliveLifeVersion(actorLife),
      targetLife,
      targetVersion: aliveLifeVersion(targetLife),
    },
  ];
  const claims: Claims = {
    poisonClaims: [],
    guardClaims: [],
  };
  // 非空关系通过本族明确登记同一数组；后面 Frame 完成后仍向这个原数组追加。
  installDreamNightLinks(claims, links);
  const damage: DamageResolutionResult = {
    deaths: [target],
    deathSources: { [target]: [DeathCause.Dream] },
  };
  const trace: string[] = [];
  let receivedThis: unknown,
    receivedWorld: World | undefined,
    receivedEffects: NightDamageEffects | undefined;
  const solver: Solver = {
    get resolve(): DamageResolutionSystem["resolve"] {
      trace.push("resolve:get");
      return function (this: unknown, inputWorld: World, effects: NightDamageEffects = {}) {
        receivedThis = this;
        receivedWorld = inputWorld;
        receivedEffects = effects;
        trace.push("resolve:called");
        return damage;
      };
    },
  };
  const roster = {
    get getAliveByRole() {
      trace.push("roster:get");
      return function (this: unknown, role: Role) {
        trace.push(this === roster ? "roster:bound" : "roster:foreign");
        if (role !== originalRole) throw new Error("literal_role_mismatch");
        return [];
      };
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(Role, "CursedFox")!,
    originalRole = descriptor.value as Role;
  let result: ReturnType<typeof composeNightDamage>;
  try {
    // 只在本测试中观察 enum 属性读取，保测试前的完整描述符用于 finally 恢复。
    Object.defineProperty(Role, "CursedFox", {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get() {
        trace.push("role:read");
        return originalRole;
      },
    });
    result = composeNightDamage({
      ...runtime(world, claims, solver, trace),
      aliveByRole: (role) => roster.getAliveByRole(role()),
    });
  } finally {
    Object.defineProperty(Role, "CursedFox", descriptor);
  }
  expect(receivedThis).toBe(solver);
  expect(receivedWorld).toBe(world);
  expect(result.damage).toBe(damage);
  expect(receivedEffects?.poisonClaims).toBe(claims.poisonClaims);
  expect(receivedEffects?.guardClaims).toBe(claims.guardClaims);
  expect([
    receivedEffects?.protectedTargets,
    receivedEffects?.immuneNightTargets,
    receivedEffects?.consecutiveDeaths,
  ]).toEqual([[target], [target], [target]]);
  const rosterIndex = trace.indexOf("roster:get");
  expect(trace.slice(rosterIndex, rosterIndex + 3)).toEqual([
    "roster:get",
    "role:read",
    "roster:bound",
  ]);
  expect(trace.indexOf("resolve:get")).toBeLessThan(trace.indexOf("world"));
  expect(result.dreamFrame).toBeInstanceOf(DreamNightFrame);
  const events: GameEvent[] = [];
  result.dreamFrame.recordDeaths([target], events);
  result.dreamFrame.recordDeaths([target], events);
  expect(events.map((event) => [event.type, event.payload] as [string, unknown])).toEqual([
    [
      "dream_death",
      {
        actorId: actor,
        targetId: target,
        day: 2,
        reason: "consecutive",
        abilityId: "literal-dream",
      },
    ],
  ]);
  const next = world.createEntity(),
    nextLife = createAliveComponent();
  world.addComponent(next, COMPONENT.Alive, nextLife);
  links.push({
    actorId: actor,
    targetId: next,
    day: 2,
    consecutive: false,
    actorLife,
    actorVersion: aliveLifeVersion(actorLife),
    targetLife: nextLife,
    targetVersion: aliveLifeVersion(nextLife),
  });
  expect(result.dreamFrame.protectedTargets(world)).toEqual([target, next]);
});
