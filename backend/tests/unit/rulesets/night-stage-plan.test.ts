/**
 * 单元测试验证夜间计划成员与元数据，输入为字面处理器／目录、自定义 getStages、惰性来源和访问器／Proxy。
 * 顺序、原 receiver 与零 getter／trap 次数是独立预期；小型真实上下文验证编译后的 actor 查询。
 * 原生成员约束与不透明来源的失败前缀分别登记；查询仍在原 World 读取点绑定，不调用模型或编译器生成预期。
 */
import { createRoleCatalog } from "../../../src/rulesets/roles/role-catalog-assembly";
import { bindNativeNightFailurePolicy } from "../../../src/rulesets/native-night-failure-policy";
import { bindNativeNightTargetPolicy } from "../../../src/rulesets/native-night-target-policy";
import { bindNativeNightEffects } from "../../../src/rulesets/native-night-effects";
import { bindNightAbilityActorQuery } from "../../../src/features/night-abilities/night-ability-actors";
import { expect, test } from "bun:test";
import { Role } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/domain/world";
import { RoleCatalog } from "../../../src/rulesets/roles/catalog";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { GameActionRequestFactory } from "../../../src/engine/actions/action-request-factory";
import type { RoleProfile } from "../../../src/rulesets/roles/contracts";
import type { NightStageContext, NightStageHandler } from "../../../src/engine/night/contracts";
import { NightStageRegistry } from "../../../src/rulesets/night-stage-plan";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

const config = { ...sixPlayerMvpConfig, roleSetups: [] };
function context(world = new World("en")): NightStageContext {
  return {
    world,
    get nightActors() {
      return bindNightAbilityActorQuery(this.world);
    },
    get nativeNightFailure() {
      return bindNativeNightFailurePolicy(() => this.world);
    },
    get nativeNightTargets() {
      return bindNativeNightTargetPolicy(() => this);
    },
    get nativeNightEffects() {
      return bindNativeNightEffects(() => this);
    },
    roleCatalog: createRoleCatalog([]),
    toolGateway: new ToolGateway(),
    events: [],
    actionProvider: { getAction: async () => null },
    isCurrent: () => true,
    previousExile: null,
    currentDay: () => 1,
    get requestFactory() {
      return GameActionRequestFactory;
    },
    makeRequest: () => {
      throw new Error("unexpected_request");
    },
    getAliveByRole: () => [],
    ensureMarks: () => {
      throw new Error("unexpected_marks");
    },
    pickMajorityTarget: () => null,
    shuffleWolves: (ids) => [...ids],
    state: {
      wolfChatOrder: [],
      endedWolves: new Set(),
      wolfVotes: {},
      wolfTarget: null,
      seerChecks: [],
    },
  };
}

test("virtual getStages is called once and safe native membership freezes without freezing external handlers", async () => {
  let calls = 0;
  const world = new World("en"),
    receivers: boolean[] = [],
    stage: NightStageHandler = {
      id: "custom",
      priority: 7,
      async execute() {
        receivers.push(this === stage);
      },
    },
    source = [stage];
  class Custom extends NightStageRegistry {
    override getStages(receivedConfig: typeof config, receivedWorld?: World) {
      calls++;
      expect(receivedConfig).toBe(config);
      expect(receivedWorld).toBe(world);
      return source;
    }
  }
  const plan = new Custom(createRoleCatalog([])).getPlan(config, world);
  if (plan.mode !== "snapshot") throw new Error("expected_snapshot_plan");
  expect(calls).toBe(1);
  expect(plan.stages).not.toBe(source);
  expect(plan.stages[0]).toBe(stage);
  expect(Object.isFrozen(plan)).toBe(true);
  expect(Object.isFrozen(plan.stages)).toBe(true);
  expect(Object.isFrozen(plan.metadata)).toBe(true);
  expect(Object.isFrozen(plan.metadata[0])).toBe(true);
  expect(Object.isFrozen(stage)).toBe(false);
  expect(Object.isFrozen(source)).toBe(false);
  expect(Object.isFrozen(world)).toBe(false);
  expect(plan.metadata).toEqual([{ ordinal: 0, kind: "data", id: "custom", priority: 7 }]);
  source.push({ id: "late", priority: 1, async execute() {} });
  stage.priority = 99;
  expect(plan.stages).toHaveLength(1);
  expect(plan.metadata).toEqual([{ ordinal: 0, kind: "data", id: "custom", priority: 7 }]);
  expect(() => Object.defineProperty(plan.stages, "0", { value: source[1] })).toThrow();
  for (const handler of plan.stages) await handler.execute(context(world));
  expect(receivers).toEqual([true]);
});

test("accessor, inherited and Proxy stage metadata is opaque without invoking getters or reflection traps", () => {
  let idReads = 0,
    priorityReads = 0,
    traps = 0;
  const accessor: NightStageHandler = {
      get id() {
        idReads++;
        return "accessor";
      },
      get priority() {
        priorityReads++;
        return 4;
      },
      async execute() {},
    },
    proxy = new Proxy<NightStageHandler>(
      { id: "proxy", priority: 8, async execute() {} },
      {
        getOwnPropertyDescriptor() {
          traps++;
          throw new Error("reflection_must_not_run");
        },
        get() {
          traps++;
          throw new Error("get_must_not_run");
        },
      },
    );
  class Inherited implements NightStageHandler {
    get id() {
      idReads++;
      return "inherited";
    }
    get priority() {
      priorityReads++;
      return 6;
    }
    async execute() {}
  }
  class Custom extends NightStageRegistry {
    override getStages() {
      return [accessor, new Inherited(), proxy];
    }
  }
  const plan = new Custom(createRoleCatalog([])).getPlan(config);
  if (plan.mode !== "snapshot") throw new Error("expected_snapshot_plan");
  expect(plan.metadata).toEqual([
    { ordinal: 0, kind: "opaque" },
    { ordinal: 1, kind: "opaque" },
    { ordinal: 2, kind: "opaque" },
  ]);
  expect(idReads).toBe(0);
  expect(priorityReads).toBe(0);
  expect(traps).toBe(0);
  expect(plan.stages[0]).toBe(accessor);
  expect(plan.stages[2]).toBe(proxy);
});

test("C22 explicitly rejects the original distinct-handler collision with the same catalog read sequence", () => {
  const beta: NightStageHandler = { id: "beta", priority: 10, async execute() {} },
    alpha: NightStageHandler = { id: "alpha", priority: 10, async execute() {} },
    conflict: NightStageHandler = { id: "beta", priority: -1, async execute() {} },
    reads: Role[] = [],
    profiles: RoleProfile[] = [
      { role: Role.Wolf, label: "wolf", skillBrief: "wolf", nightStages: [beta] },
      { role: Role.Seer, label: "seer", skillBrief: "seer", nightStages: [conflict, alpha] },
    ];
  class ObservedCatalog extends RoleCatalog {
    override runtime(role: Role) {
      reads.push(role);
      return super.runtime(role);
    }
  }
  const registry = new NightStageRegistry(new ObservedCatalog(profiles, []));
  // 固定 f4bbd7b 对这个字面冲突接受首个处理器；C22
  // 加强了该政策，原冲突输入仍保留。
  expect(() =>
    registry.getPlan({
      ...config,
      roleSetups: [
        { role: Role.Wolf, count: 1 },
        { role: Role.Seer, count: 1 },
      ],
    }),
  ).toThrow("night_stage_handler_conflict:beta");
  expect(reads).toEqual([Role.Wolf, Role.Seer, Role.Wolf, Role.Seer, Role.Wolf, Role.Seer]);
});

test("plan execution keeps current World lookup after an earlier stage creates an actor", async () => {
  const ctx = context(),
    seen: number[][] = [],
    first: NightStageHandler = {
      id: "first",
      priority: 1,
      async execute(current) {
        current.world.createEntity();
      },
    },
    second: NightStageHandler = {
      id: "second",
      priority: 2,
      async execute(current) {
        seen.push(current.world.entityIds());
      },
    };
  class Custom extends NightStageRegistry {
    override getStages() {
      return [first, second];
    }
  }
  const plan = new Custom(createRoleCatalog([])).getPlan(config, ctx.world);
  for (const handler of plan.stages) await handler.execute(ctx);
  expect(seen).toEqual([[1]]);
  expect(plan.metadata).toEqual([
    { ordinal: 0, kind: "data", id: "first", priority: 1 },
    { ordinal: 1, kind: "data", id: "second", priority: 2 },
  ]);
});

for (const condition of ["throw-after-first", "requires-first-commit"] as const)
  test(`opaque iterator ${condition} preserves first commit and dependent next timing`, async () => {
    const effects: string[] = [],
      pulls: string[] = [],
      failure = new Error("iterator_after_first"),
      first: NightStageHandler = {
        id: "first",
        priority: 1,
        async execute() {
          effects.push("first_commit");
        },
      },
      second: NightStageHandler = {
        id: "second",
        priority: 2,
        async execute() {
          effects.push("second_commit");
        },
      },
      source = [first, second];
    let iteratorCalls = 0;
    Object.defineProperty(source, Symbol.iterator, {
      value: function* () {
        iteratorCalls++;
        pulls.push("first");
        yield first;
        pulls.push("after_first");
        if (condition === "throw-after-first") throw failure;
        if (!effects.includes("first_commit")) throw new Error("first_stage_not_committed");
        yield second;
      },
    });
    class Custom extends NightStageRegistry {
      override getStages() {
        return source;
      }
    }
    const plan = new Custom(createRoleCatalog([])).getPlan(config);
    expect(plan.mode).toBe("opaque");
    expect(plan.stages).toBe(source);
    expect(plan.metadata).toEqual([]);
    expect(iteratorCalls).toBe(0);
    let caught: unknown;
    try {
      for (const handler of plan.stages) await handler.execute(context());
    } catch (error) {
      caught = error;
    }
    expect(iteratorCalls).toBe(1);
    expect(pulls).toEqual(["first", "after_first"]);
    if (condition === "throw-after-first") {
      expect(effects).toEqual(["first_commit"]);
      expect(caught).toBe(failure);
    } else {
      expect(effects).toEqual(["first_commit", "second_commit"]);
      expect(caught).toBeUndefined();
    }
  });

test("opaque source index getter is pulled only after the preceding stage commits", async () => {
  const events: string[] = [],
    first: NightStageHandler = {
      id: "first",
      priority: 1,
      async execute() {
        events.push("first_commit");
      },
    },
    second: NightStageHandler = {
      id: "second",
      priority: 2,
      async execute() {
        events.push("second_commit");
      },
    },
    source = [first, second];
  Object.defineProperty(source, "1", {
    get() {
      events.push("index_1");
      if (!events.includes("first_commit")) throw new Error("first_stage_not_committed");
      return second;
    },
  });
  class Custom extends NightStageRegistry {
    override getStages() {
      return source;
    }
  }
  const plan = new Custom(createRoleCatalog([])).getPlan(config);
  expect(plan.mode).toBe("opaque");
  expect(plan.stages).toBe(source);
  expect(events).toEqual([]);
  expect(plan.metadata).toEqual([]);
  for (const handler of plan.stages) await handler.execute(context());
  expect(events).toEqual(["first_commit", "index_1", "second_commit"]);
});

test("Proxy arrays, Array subclasses and foreign iterables stay opaque without eager access", () => {
  let traps = 0,
    pulls = 0;
  const stage: NightStageHandler = { id: "one", priority: 1, async execute() {} },
    proxy = new Proxy([stage], {
      get() {
        traps++;
        throw new Error("source_get_must_not_run");
      },
      getPrototypeOf() {
        traps++;
        throw new Error("source_proto_must_not_run");
      },
      getOwnPropertyDescriptor() {
        traps++;
        throw new Error("source_descriptor_must_not_run");
      },
    });
  class ForeignArray extends Array<NightStageHandler> {}
  const foreignIterable = {
    *[Symbol.iterator]() {
      pulls++;
      yield stage;
    },
  };
  // 显式坏类型返回夹具用于核对旧 JS override 边界。
  const sources = [
    proxy,
    new ForeignArray(stage),
    foreignIterable as unknown as NightStageHandler[],
  ];
  for (const source of sources) {
    class Custom extends NightStageRegistry {
      override getStages() {
        return source;
      }
    }
    const plan = new Custom(createRoleCatalog([])).getPlan(config);
    expect(plan.mode).toBe("opaque");
    expect(plan.stages).toBe(source);
    expect(plan.metadata).toEqual([]);
  }
  expect(traps).toBe(0);
  expect(pulls).toBe(0);
});

test("native array snapshot intentionally excludes stages appended during await while legacy iteration observes them", async () => {
  const run = async (snapshot: boolean) => {
    const effects: string[] = [];
    const second: NightStageHandler = {
      id: "second",
      priority: 2,
      async execute() {
        effects.push("second_commit");
      },
    };
    const source: NightStageHandler[] = [
      {
        id: "first",
        priority: 1,
        async execute() {
          await Promise.resolve();
          effects.push("first_commit");
          source.push(second);
        },
      },
    ];
    class Custom extends NightStageRegistry {
      override getStages() {
        return source;
      }
    }
    const registry = new Custom(createRoleCatalog([]));
    const selected = snapshot ? registry.getPlan(config).stages : registry.getStages();
    for (const handler of selected) await handler.execute(context());
    return effects;
  };
  expect(await run(false)).toEqual(["first_commit", "second_commit"]);
  expect(await run(true)).toEqual(["first_commit"]);
});
