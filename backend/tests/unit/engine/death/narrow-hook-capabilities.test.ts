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
import { captureNightLife } from "../../../../src/domain/night-effects";
import { DeathResolution } from "../../../../src/engine/death-resolution";
import { EventRegistry } from "../../../../src/engine/events/event-registry";
import { ToolGateway } from "../../../../src/engine/actions/tool-gateway";

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

// 真实死亡结算提供chooser；custom只观察候选，不借观察结果消费枪或改写目标生命。
test("narrow death chooser: actual collection returns scalar DTO to custom while native keeps original mapped scope", async () => {
  const f = fixture(),
    events: GameEvent[] = [];
  f.world.getComponent(f.actor, COMPONENT.Alive)!.alive = true;
  const targetLife = f.world.getComponent(f.target, COMPONENT.Alive)!;
  let asks = 0,
    customCalls = 0;
  const custom: DeathHook = async (_runtime, ids, _sources, choose) => {
    customCalls++;
    expect(ids).toEqual([1]);
    const selected = await choose(f.actor);
    expect(selected.kind).toBe("shot");
    expect(Object.keys(selected).sort()).toEqual(["deathActionId", "kind", "targetId"]);
    expect("targetScope" in selected).toBe(false);
    expect("mappingCurrent" in selected).toBe(false);
    expect("life" in selected).toBe(false);
    if (selected.kind !== "shot") throw new Error("literal_expected_shot");
    expect(selected.targetId).toBe(2);
    expect(Number.isSafeInteger(selected.deathActionId)).toBe(true);
    selected.targetId = 999;
    expect(f.world.getComponent(f.target, COMPONENT.Alive)).toBe(targetLife);
    expect(targetLife.alive).toBe(true);
    return { extraDeaths: [], extraDeathSources: {} };
  };
  await new DeathResolution(
    f.world,
    events,
    new ToolGateway(),
    new EventRegistry(new HookRegistry([], [custom])),
    { day: 1, phase: Phase.Day, gameOver: false, result: null },
  ).resolve(
    [f.actor],
    { [f.actor]: [DeathCause.Shot] },
    {
      async getAction(request) {
        asks++;
        expect(request.allowedTools).toEqual(["shoot"]);
        return { name: "shoot", args: { target_id: f.target } };
      },
    },
    Phase.Day,
    Phase.Day,
  );
  expect(asks).toBe(1);
  expect(customCalls).toBe(1);
  expect(f.stock.canShoot).toBe(true);
  expect(targetLife.alive).toBe(true);
  expect(events.some((event) => event.type === "hunter_shot")).toBe(false);
  expect(f.world.activeDeathActionCount).toBe(0);

  // 内建command必须继续消费同一完整selection，不能由公共DTO重捕目标或丢失映射当前性。
  const native = fixture(),
    originalScope = captureNightLife(native.world, native.target)!;
  const permit = native.world.openDeathAction(native.actor, "shoot", Phase.Day, 1);
  let mappingChecks = 0;
  try {
    const result = await invokeDeathHook(
      hunterDeathHook,
      native.world,
      [native.actor],
      { [native.actor]: [DeathCause.Exile] },
      async () => ({
        kind: "shot",
        targetId: native.target,
        deathActionId: permit.id,
        targetScope: originalScope,
        mappingCurrent: () => {
          mappingChecks++;
          return true;
        },
      }),
      [],
      {
        day: 1,
        deathOriginPhase: Phase.Day,
        deferShotCommit: true,
        nightEffect: false,
        blocksNightShot: () => false,
      },
    );
    expect(mappingChecks).toBe(1);
    expect(result.pendingShots).toHaveLength(1);
    expect(result.pendingShots![0]!.targetScope).toBe(originalScope);
    expect(native.stock.canShoot).toBe(false);
    expect(native.world.getComponent(native.target, COMPONENT.Alive)).toBe(originalScope.life);
    expect(originalScope.life.alive).toBe(true);
  } finally {
    permit.close();
  }
});
