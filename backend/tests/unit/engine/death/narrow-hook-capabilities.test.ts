/**
 * 单元测试验证真实hook注册表的窄运行对象与本族死亡枪命令。
 * 手写两个World及字面库存，只驱动一次hook，不启动阶段经理、录制、模型或网络。
 * custom／同名新函数不继承内建命令；真实原体命令只消费所属World，选择异常保同一Error及未付库存。
 */
import { expect, test } from "bun:test";
import { Camp, DeathCause, Phase, Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/domain/world";
import { bindDreamLifeQueries } from "../../../../src/domain/dream-night-effects";
import { COMPONENT } from "../../../../src/domain/components/names";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import {
  HookRegistry,
  invokeDeathHook,
  type DeathHook,
} from "../../../../src/engine/hooks/registry";
import { hunterDeathHook } from "../../../../src/features/hunter/death-hook";
import { setHunterState } from "../../../../src/features/hunter/ports";

function fixture() {
  const world = new World("en"),
    actor = world.createEntity(),
    target = world.createEntity();
  const role = createRoleComponent(Role.Hunter),
    stock = { canShoot: true };
  setHunterState(role, stock);
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(actor, COMPONENT.Alive, createAliveComponent(false));
  world.addComponent(target, COMPONENT.Role, createRoleComponent(Role.Villager));
  world.addComponent(target, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(target, COMPONENT.Alive, createAliveComponent());
  return { world, actor, target, stock };
}

test("narrow hook runtime: custom and same-name callbacks receive scalar/copy queries without a World or native command", async () => {
  const f = fixture(),
    other = fixture(),
    events: GameEvent[] = [];
  let calls = 0;
  const custom: DeathHook = async (runtime, ids, sources) => {
    calls++;
    expect(Object.keys(runtime).sort()).toEqual(["ports", "queries"]);
    expect(Object.keys(runtime.queries).sort()).toEqual(["alive", "camp", "entityIds", "role"]);
    expect(Object.keys(runtime.ports)).toEqual([]);
    expect("world" in runtime).toBe(false);
    expect("getWorld" in runtime).toBe(false);
    expect("addComponent" in runtime.queries).toBe(false);
    expect("removeComponent" in runtime.queries).toBe(false);
    expect("createEntity" in runtime.queries).toBe(false);
    expect(runtime.queries.role(f.actor)).toBe(Role.Hunter);
    expect(runtime.queries.camp(f.actor)).toBe(Camp.Good);
    expect(runtime.queries.alive(f.actor)).toBe(false);
    const idsCopy = runtime.queries.entityIds();
    idsCopy.push(999);
    expect(f.world.entityIds()).toEqual([1, 2]);
    expect(other.world.entityIds()).toEqual([1, 2]);
    expect(ids).toEqual([1]);
    expect(sources).toEqual({ 1: [DeathCause.Exile] });
    return { extraDeaths: [], extraDeathSources: {} };
  };
  // 函数名相同仍不是登记的实际函数身份；不借名称或角色ID取得本族命令。
  Object.defineProperty(custom, "name", { value: hunterDeathHook.name });
  await new HookRegistry([], [custom]).onDeath(
    f.world,
    [f.actor],
    { [f.actor]: [DeathCause.Exile] },
    async () => ({ kind: "invalid" }),
    events,
  );
  expect(calls).toBe(1);
  expect(f.stock.canShoot).toBe(true);
  expect(other.stock.canShoot).toBe(true);
  expect(events).toEqual([]);
});

test("narrow native command: real Hunter pass consumes only its original stock and thrown selection preserves the unpaid prefix", async () => {
  const f = fixture(),
    other = fixture(),
    events: GameEvent[] = [];
  const permit = f.world.openDeathAction(f.actor, "shoot", Phase.Day, 1);
  try {
    const result = await invokeDeathHook(
      hunterDeathHook,
      f.world,
      [f.actor],
      { [f.actor]: [DeathCause.Exile] },
      async () => ({ kind: "pass", deathActionId: permit.id }),
      events,
      { day: 1, deathOriginPhase: Phase.Day, nightEffect: false, blocksNightShot: () => false },
    );
    expect(result.extraDeaths).toEqual([]);
    expect(result.extraDeathSources).toEqual({});
    expect(f.stock.canShoot).toBe(false);
    expect(other.stock.canShoot).toBe(true);
    expect(f.world.getComponent(f.target, COMPONENT.Alive)!.alive).toBe(true);
    expect(events).toEqual([]);
  } finally {
    permit.close();
  }
  const fresh = fixture(),
    failure = new Error("narrow_native_choice_failed");
  let asks = 0;
  expect(
    await invokeDeathHook(
      hunterDeathHook,
      fresh.world,
      [fresh.actor],
      { [fresh.actor]: [DeathCause.Exile] },
      async () => {
        asks++;
        throw failure;
      },
      events,
      { day: 1, deathOriginPhase: Phase.Day, nightEffect: false, blocksNightShot: () => false },
    ).catch((error) => error),
  ).toBe(failure);
  expect(asks).toBe(1);
  expect(fresh.stock.canShoot).toBe(true);
  expect(fresh.world.getComponent(fresh.target, COMPONENT.Alive)!.alive).toBe(true);
  expect(events).toEqual([]);
});

test("narrow Dream query: boolean identity preserves callee-before-id, original receiver and query-before-reference failure", () => {
  const f = fixture(),
    original = f.world.getComponent(f.target, COMPONENT.Alive)!;
  const queries = bindDreamLifeQueries(f.world),
    trace: string[] = [];
  expect(Object.keys(queries)).toEqual(["matchesAlive"]);
  expect("world" in queries).toBe(false);
  expect("getWorld" in queries).toBe(false);
  expect("alive" in queries).toBe(false);
  Object.defineProperty(f.world, "getComponent", {
    configurable: true,
    get() {
      trace.push("callee");
      return function (this: unknown, id: number, slot: unknown) {
        trace.push("call");
        expect(this).toBe(f.world);
        expect(id).toBe(f.target);
        expect(slot).toBe(COMPONENT.Alive);
        return original;
      };
    },
  });
  const input = {
    get id() {
      trace.push("id");
      // 原callee必须已捕获；席位getter替换World方法不能改变这一次的原调用。
      Object.defineProperty(f.world, "getComponent", {
        configurable: true,
        value() {
          throw new Error("replacement_must_not_run");
        },
      });
      return f.target;
    },
  };
  expect(
    queries.matchesAlive(input.id, () => {
      trace.push("original");
      return original;
    }),
  ).toBe(true);
  expect(trace).toEqual(["callee", "id", "call", "original"]);
  const failure = new Error("dream_life_query_failed");
  let referenceReads = 0;
  Object.defineProperty(f.world, "getComponent", {
    configurable: true,
    value() {
      throw failure;
    },
  });
  expect(() =>
    queries.matchesAlive(f.target, () => {
      referenceReads++;
      return original;
    }),
  ).toThrow(failure);
  expect(referenceReads).toBe(0);
  const other = fixture();
  expect(bindDreamLifeQueries(other.world).matchesAlive(other.target, () => original)).toBe(false);
});
