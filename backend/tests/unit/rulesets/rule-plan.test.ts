/**
 * 单元测试：验证真实规则计划身份、固定标准贡献与晚调度兼容边界。
 * 输入：原板子、已支持的 handler/profile 变更、实际赠予及注入惰性来源；
 * 输出与独立预期：同 owner 引用、明确 revision 拒绝、字面 iterator/getter 前缀。
 * 不跑完整对局、服务器或文件记录，不以生产生成的胜者充当独立规则 oracle。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { World } from "../../../src/core/domain/world";
import { Role } from "../../../src/core/domain/identity";
import { bindBoardParameters } from "../../../src/rulesets/board-parameters";
import { RulePlan } from "../../../src/rulesets/rule-plan";
import {
  NightStageRegistry,
  getDefaultNightStageRegistry,
} from "../../../src/rulesets/night-stage-plan";
import { getDefaultRoleCatalog } from "../../../src/game/mechanisms/roles/role-catalog-assembly";
import type {
  NightStageHandler,
  NightStageContext,
} from "../../../src/game/mechanisms/stages/night/contracts";
import { sixPlayerMvpConfig } from "../../../src/runtime/scenarios/six_player_mvp";
import { merchantScenario } from "../../support/features/miracle-merchant/builders/scenario";
import { grantNightAbility } from "../../../src/game/mechanisms/roles/ability_changes";

test("bootstrap and manager expose one RulePlan and the original parameter owner", () => {
  const game = bootstrapGame(sixPlayerMvpConfig, {
    fixedRoles: [Role.Wolf, Role.Wolf, Role.Seer, Role.Guard, Role.Villager, Role.Villager],
  });
  expect(game.rulePlan).toBe(game.phaseManager.getRulePlan());
  expect(game.rulePlan.parameters).toBe(game.parameters);
  expect(game.rulePlan.parameters.board).toBe(game.boardConfig);
  const encoded = game.rulePlan.encodeParameters();
  expect(encoded).toEqual(game.parameters.encode());
  expect(encoded).not.toBe(game.boardConfig);
  encoded.roleSetups[0]!.count += 1;
  expect(game.boardConfig.roleSetups[0]!.count).not.toBe(encoded.roleSetups[0]!.count);
});

test("standard handler order changes remain observable to the legacy collector but require a plan revision", () => {
  const world = new World(),
    plan = RulePlan.compile(bindBoardParameters(world, sixPlayerMvpConfig));
  const registry = getDefaultNightStageRegistry();
  const first = plan.nightPlan(registry, () => world);
  const handler = getDefaultRoleCatalog().runtime(Role.Seer)!.nightStages![0]!;
  const priority = handler.priority;
  try {
    handler.priority = 1;
    const legacy = registry.getPlan(plan.parameters.board, world);
    expect(
      legacy.metadata.find((item) => item.kind === "data" && item.id === handler.id),
    ).toMatchObject({ priority: 1 });
    expect(() => plan.nightPlan(registry, () => world)).toThrow("rule_plan_revision_not_supported");
  } finally {
    handler.priority = priority;
  }
  expect(plan.nightPlan(registry, () => world).metadata).toEqual(first.metadata);
});

test("standard profile membership growth requires a revision and never silently executes a new handler", () => {
  const world = new World(),
    plan = RulePlan.compile(bindBoardParameters(world, sixPlayerMvpConfig));
  const registry = getDefaultNightStageRegistry(),
    profile = getDefaultRoleCatalog().runtime(Role.Seer)!;
  const original = profile.nightStages!;
  plan.nightPlan(registry, () => world);
  const late: NightStageHandler = {
    id: "new_test_stage",
    priority: 998,
    async execute() {
      throw new Error("must_not_execute");
    },
  };
  try {
    profile.nightStages = [...original, late];
    expect(registry.getPlan(plan.parameters.board, world).stages).toContain(late);
    expect(() => plan.nightPlan(registry, () => world)).toThrow("rule_plan_revision_not_supported");
  } finally {
    profile.nightStages = original;
  }
});

test("injected opaque iterators retain next-after-commit and iterator-close prefixes", async () => {
  const trace: string[] = [];
  const first: NightStageHandler = {
    id: "first",
    priority: 1,
    async execute() {
      trace.push("commit");
    },
  };
  const error = new Error("late_pull_failure");
  class Injected extends NightStageRegistry {
    override getStages() {
      return {
        *[Symbol.iterator]() {
          try {
            trace.push("first");
            yield first;
            trace.push("next");
            throw error;
          } finally {
            trace.push("close");
          }
        },
      } as unknown as NightStageHandler[];
    }
  }
  const world = new World(),
    plan = RulePlan.compile(bindBoardParameters(world, sixPlayerMvpConfig));
  const schedule = plan.nightPlan(new Injected(), () => world);
  expect(trace).toEqual([]);
  expect(schedule.mode).toBe("opaque");
  let caught: unknown;
  try {
    for (const entry of schedule.entries) await entry.handler.execute({} as NightStageContext);
  } catch (failure) {
    caught = failure;
  }
  expect(caught).toBe(error);
  expect(trace).toEqual(["first", "commit", "next", "close"]);
});

test("an injected ordinary array keeps late execute getter and receiver instead of caching its function", async () => {
  const trace: string[] = [],
    world = new World();
  const handler: NightStageHandler = {
    id: "injected",
    priority: 1,
    get execute() {
      trace.push("get execute");
      return async function (this: NightStageHandler) {
        expect(this).toBe(handler);
        trace.push("execute");
      };
    },
  };
  class Injected extends NightStageRegistry {
    override getStages() {
      return [handler];
    }
  }
  const plan = RulePlan.compile(bindBoardParameters(world, sixPlayerMvpConfig));
  const schedule = plan.nightPlan(new Injected(), () => world);
  expect(trace).toEqual([]);
  expect(schedule.definition).toBeNull();
  for (const entry of schedule.entries) await entry.handler.execute({} as NightStageContext);
  expect(trace).toEqual(["get execute", "execute"]);
});

test("a fixed standard contribution cannot silently become an accessor protocol", () => {
  const world = new World(),
    plan = RulePlan.compile(bindBoardParameters(world, sixPlayerMvpConfig));
  const registry = getDefaultNightStageRegistry(),
    profile = getDefaultRoleCatalog().runtime(Role.Seer)!;
  const original = Object.getOwnPropertyDescriptor(profile, "nightStages")!;
  let reads = 0;
  plan.nightPlan(registry, () => world);
  try {
    Object.defineProperty(profile, "nightStages", {
      configurable: true,
      enumerable: true,
      get() {
        reads++;
        return original.value;
      },
    });
    expect(() => plan.nightPlan(registry, () => world)).toThrow("rule_plan_revision_not_supported");
    expect(reads).toBe(1); // 仅执行原 pack getter；新增描述器采集不调用它。
  } finally {
    Object.defineProperty(profile, "nightStages", original);
  }
});

test("a forged execution-plan alias fails its private brand with zero Proxy traps", () => {
  expect(RulePlan.isOwned(Object.create(RulePlan.prototype))).toBe(false);
  let traps = 0;
  const proxy = new Proxy(
    {},
    {
      get() {
        traps++;
        throw new Error("must_not_read");
      },
      has() {
        traps++;
        throw new Error("must_not_check");
      },
    },
  );
  expect(RulePlan.isOwned(proxy)).toBe(false);
  expect(traps).toBe(0);
});

test("a previously fixed built-in collector cannot switch to a Proxy schedule", () => {
  const world = new World(),
    plan = RulePlan.compile(bindBoardParameters(world, sixPlayerMvpConfig));
  const registry = getDefaultNightStageRegistry();
  plan.nightPlan(registry, () => world);
  const original = Object.getOwnPropertyDescriptor(registry, "getStages");
  let pulls = 0;
  try {
    const source = new Proxy([], {
      get(target, key, receiver) {
        pulls++;
        return Reflect.get(target, key, receiver);
      },
    });
    Object.defineProperty(registry, "getStages", { configurable: true, value: () => source });
    expect(() => plan.nightPlan(registry, () => world)).toThrow("rule_plan_revision_not_supported");
    expect(pulls).toBe(0);
  } finally {
    if (original) Object.defineProperty(registry, "getStages", original);
    else delete (registry as unknown as { getStages?: unknown }).getStages;
  }
});

test("a legal late gift uses its declared default reservation without revising the fixed plan", () => {
  const scenario = merchantScenario("check");
  const game = bootstrapGame(scenario.board.config, { fixedRoles: scenario.roles });
  const registry = getDefaultNightStageRegistry();
  const before = game.rulePlan.nightPlan(registry, () => game.world);
  const granted = grantNightAbility(
    game.world,
    6,
    {
      id: "gift:late_rule_plan",
      kind: "guard",
      state: { lastTarget: null },
      source: { kind: "gift", actorId: 3 },
      startsOnDay: 1,
      maxUses: 1,
    },
    [],
  );
  const after = game.rulePlan.nightPlan(registry, () => game.world);
  expect(after.metadata).toEqual(before.metadata);
  expect(after.definition!.roles.map((row) => row.role)).toEqual(
    before.definition!.roles.map((row) => row.role),
  );
  expect(granted.kind).toBe("guard");
  expect(game.rulePlan.parameters).toBe(game.parameters);
});

for (const field of ["id", "priority"] as const)
  test(`fixed standard handler ${field} cannot become an opaque getter`, () => {
    const world = new World(),
      plan = RulePlan.compile(bindBoardParameters(world, sixPlayerMvpConfig));
    const registry = getDefaultNightStageRegistry(),
      handler = getDefaultRoleCatalog().runtime(Role.Seer)!.nightStages![0]!;
    const descriptor = Object.getOwnPropertyDescriptor(handler, field)!;
    plan.nightPlan(registry, () => world);
    let reads = 0;
    try {
      Object.defineProperty(handler, field, {
        configurable: true,
        enumerable: true,
        get() {
          reads++;
          return descriptor.value;
        },
      });
      expect(() => plan.nightPlan(registry, () => world)).toThrow(
        "rule_plan_revision_not_supported",
      );
      // 原注册/排序读取仍发生；描述器识别不额外执行 getter，也不悄悄放弃固定定义。
      expect(reads).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(handler, field, descriptor);
    }
  });

test("getPlan method lookup retains its receiver and precedes the World argument getter", () => {
  const trace: string[] = [],
    world = new World();
  const plan = RulePlan.compile(bindBoardParameters(world, sixPlayerMvpConfig));
  const registry = new NightStageRegistry(),
    original = registry.getPlan;
  Object.defineProperty(registry, "getPlan", {
    get() {
      trace.push("method");
      return function (
        this: NightStageRegistry,
        ...args: Parameters<NightStageRegistry["getPlan"]>
      ) {
        expect(this).toBe(registry);
        trace.push("call");
        return original.apply(this, args);
      };
    },
  });
  plan.nightPlan(registry, () => {
    trace.push("world");
    return world;
  });
  expect(trace).toEqual(["method", "world", "call"]);
});
