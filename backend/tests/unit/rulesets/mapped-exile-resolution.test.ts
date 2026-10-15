/**
 * 单元测试验证诡术师最终放逐规则的原字段晚读、同 payload 引用及映射付款失败前缀。
 * 输入为测试自有 World／原体／配对和明确 getter、hook receiver、事件故障；顺序与目标采用字面预期。
 * 映射不重计票，missed 不跳过流水线 Noble，Animal 抑制普通出局事实；本测试不推进票／PK或完整阶段。
 * 规则依据 docs/rules/awa-trickster-exile-v1.md；只运行内存 owner，不使用模型或网络。
 */
import { expect, test } from "bun:test";
import { World } from "../../../src/domain/world";
import { COMPONENT } from "../../../src/domain/components/names";
import { createRoleComponent } from "../../../src/domain/components/role";
import { createAliveComponent } from "../../../src/domain/components/alive";
import { createIdentityComponent } from "../../../src/domain/entities/player";
import { Role, Camp, type GameEvent } from "../../../src/domain/model";
import { createTricksterState } from "../../../src/features/trickster/state-slot";
import {
  installTricksterBoard,
  beginTricksterNight,
  commitTricksterExchange,
  finishTricksterNight,
} from "../../../src/features/trickster/night-frame";
import { resolveTricksterExile } from "../../../src/features/trickster/ports";
import {
  prepareMappedExile,
  resolveMappedExile,
  mappedExileSummary,
} from "../../../src/rulesets/mapped-exile-resolution";

function fixture() {
  const world = new World();
  for (const [index, roleId] of [Role.Trickster, Role.Villager, Role.Wolf].entries()) {
    const id = world.createEntity(),
      role = createRoleComponent(roleId);
    // 仅测试自有演员的初始容器安装；声明收窄不改变对象／写入或放宽生产读写口。
    if (roleId === Role.Trickster)
      (role as { privateState: object }).privateState = { trickster: createTricksterState() };
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, {
      camp: roleId === Role.Wolf || roleId === Role.Trickster ? Camp.Wolf : Camp.Good,
    });
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, index + 1, `p${id}`));
  }
  installTricksterBoard(world);
  beginTricksterNight(world, 1);
  commitTricksterExchange(world, 1, 1, [2, 3]);
  finishTricksterNight(world, 1);
  return world;
}

test("disabled mapping skips runtime fields and enabled mapping reads effectiveId after the original push", () => {
  const world = fixture(),
    events: GameEvent[] = [],
    trace: string[] = [];
  expect(
    prepareMappedExile(
      {
        get enabled() {
          trace.push("enabled");
          return undefined;
        },
        get world(): never {
          throw new Error("literal_disabled_mapping_world");
        },
        get day(): never {
          throw new Error("literal_disabled_mapping_day");
        },
        get events(): never {
          throw new Error("literal_disabled_mapping_events");
        },
      },
      2,
    ),
  ).toEqual({ mapped: null, effectiveTarget: 2 });
  expect(trace).toEqual(["enabled"]);
  trace.length = 0;
  Object.defineProperty(events, "push", {
    get() {
      trace.push("push");
      return function (this: GameEvent[], event: GameEvent) {
        trace.push("push-call");
        expect(this).toBe(events);
        const result = Array.prototype.push.call(this, event);
        Object.defineProperty(event.payload, "effectiveId", {
          get() {
            trace.push("effective");
            return 3;
          },
        });
        return result;
      };
    },
  });
  const originalNow = Date.now;
  Date.now = () => {
    trace.push("clock");
    return 7;
  };
  let output;
  try {
    output = prepareMappedExile(
      {
        get enabled() {
          trace.push("enabled");
          return { policy: "awa_trickster_exile_v1" as const };
        },
        get world() {
          trace.push("world");
          return world;
        },
        get day() {
          trace.push("day");
          return 1;
        },
        get events() {
          trace.push("events");
          return events;
        },
      },
      2,
    );
  } finally {
    Date.now = originalNow;
  }
  expect(trace).toEqual([
    "enabled",
    "world",
    "day",
    "events",
    "push",
    "clock",
    "push-call",
    "effective",
  ]);
  expect(output!.mapped as unknown).toBe(events[0]!.payload);
  expect(output!.effectiveTarget).toBe(3);
  expect(events[0]!.timestamp).toBe(7);
  expect(() => resolveTricksterExile(world, 1, 2)).toThrow("trickster_exile_unsettled");
});

test("post-Noble hook retains receiver and late missed projection while Animal and misses suppress ordinary facts", () => {
  const world = fixture(),
    events: GameEvent[] = [],
    trace: string[] = [],
    hookRemoved = [3];
  const { mapped, effectiveTarget } = prepareMappedExile(
    { enabled: { policy: "awa_trickster_exile_v1" }, world, day: 1, events },
    2,
  );
  Object.defineProperty(mapped!, "missed", {
    configurable: true,
    get() {
      trace.push("missed");
      return false;
    },
  });
  const registry = {
    get onVotedOut() {
      trace.push("callee");
      return function (this: unknown, givenWorld: World, target: number, givenEvents: GameEvent[]) {
        trace.push("hook");
        expect(this).toBe(registry);
        expect(givenWorld).toBe(world);
        expect(target).toBe(3);
        expect(givenEvents).toBe(events);
        return { prevented: false, removed: hookRemoved, reason: "literal_original_hook" };
      };
    },
  };
  Object.defineProperty(events, "push", {
    get() {
      trace.push("push");
      return function (this: GameEvent[], event: GameEvent) {
        trace.push("push-call");
        Object.defineProperty(mapped!, "missed", {
          configurable: true,
          get() {
            trace.push("missed-late");
            return true;
          },
        });
        return Array.prototype.push.call(this, event);
      };
    },
  });
  const removed = resolveMappedExile(
    {
      get eventRegistry() {
        trace.push("registry");
        return registry;
      },
      get world() {
        trace.push("world");
        return world;
      },
      get events() {
        trace.push("events");
        return events;
      },
      get animalUnit() {
        trace.push("animal");
        return undefined;
      },
    },
    mapped,
    effectiveTarget,
  );
  expect(trace).toEqual([
    "missed",
    "registry",
    "callee",
    "world",
    "events",
    "hook",
    "animal",
    "events",
    "push",
    "push-call",
  ]);
  expect(removed).toEqual([3]);
  expect(removed).not.toBe(hookRemoved);
  expect(events.map((e) => e.type)).toEqual(["exile_target_mapped", "voted_out"]);
  expect(mappedExileSummary(mapped, effectiveTarget)).toEqual({ effectiveTarget: null });
  expect(trace.at(-1)).toBe("missed-late");
  expect(
    resolveMappedExile(
      {
        get world(): never {
          throw new Error("literal_miss_world");
        },
        get eventRegistry(): never {
          throw new Error("literal_miss_registry");
        },
        get events(): never {
          throw new Error("literal_miss_events");
        },
        get animalUnit(): never {
          throw new Error("literal_no_removed_animal");
        },
      },
      mapped,
      effectiveTarget,
    ),
  ).toEqual([]);
  const animalEvents: GameEvent[] = [];
  const animalRemoved = resolveMappedExile(
    {
      world,
      events: animalEvents,
      eventRegistry: {
        onVotedOut() {
          return { prevented: false, removed: [3], reason: "literal_animal_proposal" };
        },
      },
      animalUnit: {},
    },
    null,
    3,
  );
  expect(animalRemoved).toEqual([3]);
  expect(animalEvents).toEqual([]);
  expect(mappedExileSummary(null, 3)).toEqual({});
});

test("mapped or voted_out push failure cannot refund the original one-use mapping or hook prefix", () => {
  for (const point of ["exile_target_mapped", "voted_out"] as const) {
    const world = fixture(),
      events: GameEvent[] = [],
      failure = new Error(`literal_${point}_push_failure`);
    let hookCalls = 0;
    Object.defineProperty(events, "push", {
      value: function (this: GameEvent[], event: GameEvent) {
        if (event.type === point) throw failure;
        return Array.prototype.push.call(this, event);
      },
    });
    expect(() => {
      const prepared = prepareMappedExile(
        { enabled: { policy: "awa_trickster_exile_v1" }, world, day: 1, events },
        2,
      );
      resolveMappedExile(
        {
          world,
          events,
          eventRegistry: {
            onVotedOut() {
              hookCalls++;
              return { prevented: false, removed: [3], reason: "literal_paid_hook" };
            },
          },
          animalUnit: undefined,
        },
        prepared.mapped,
        prepared.effectiveTarget,
      );
    }).toThrow(failure);
    expect(hookCalls).toBe(point === "exile_target_mapped" ? 0 : 1);
    expect(events.map((e) => e.type)).toEqual(
      point === "exile_target_mapped" ? [] : ["exile_target_mapped"],
    );
    expect(() => resolveTricksterExile(world, 1, 2)).toThrow("trickster_exile_unsettled");
  }
});
