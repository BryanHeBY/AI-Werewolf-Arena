/**
 * 单元测试验证完整死亡枪资格捕获的缺失赠枪短路、原生政策／死因重验与晚命令裸调用。
 * 输入为真实 World／原库存／赠枪生命以及手写查询轨迹；输出用独立次序、原引用和资格结果验收。
 * 不打开死亡行动或消费资源，不运行整局／模型；库存知情、捕获函数与行动许可分别拥有。
 */
import { expect, test } from "bun:test";
import { Camp, Role, Phase, DeathCause, type DeathSources, type HunterState, type GameEvent } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { captureDeathShotEligibility, grantDeathGun, armDeathGun } from "../../../../src/game/mechanisms/roles/death_abilities";
import { demonHunterNativeGunCurrent } from "../../../../src/game/mechanisms/roles/demon_hunter/ports";

function hunter() {
  const world = new World(), actorId = world.createEntity(), role = createRoleComponent(Role.Hunter, Camp.Good);
  world.addComponent(actorId, COMPONENT.Role, role);
  world.addComponent(actorId, COMPONENT.Alive, createAliveComponent());
  return { world, actorId, role };
}

test("a missing gifted gun returns before another World, native slot or cause read", () => {
  const trace: string[] = [], world = new World();
  const sources: DeathSources = { get 1(): DeathCause[] { throw new Error("cause_must_not_read"); } };
  const qualification = captureDeathShotEligibility({
    get world() { trace.push("world"); return world; },
    get day() { trace.push("day"); return 2; },
    get demonHunterNativeGunCurrent(): typeof demonHunterNativeGunCurrent { throw new Error("demon_must_not_read"); },
  }, 1, "gift-gun:missing", sources, Phase.Day, () => { throw new Error("scope_must_not_read"); });
  expect(qualification).toBeNull();
  expect(trace).toEqual(["world", "day"]);
});

test("native qualification retains Demon then scope then stock and cause order and rechecks captured policy", () => {
  const f = hunter(), trace: string[] = [];
  let demonAllowed = false, canShoot = true;
  let policy: HunterState["deathActionPolicy"] = "awa_qualified_sources_v1";
  const stock: HunterState = {
    get canShoot() { trace.push("canShoot"); return canShoot; },
    get deathActionPolicy() { trace.push("policy"); return policy; },
  };
  Object.defineProperty(f.role.privateState, "hunter", {
    get() { trace.push("stock"); return stock; },
  });
  let causes = [DeathCause.Exile];
  const sources: DeathSources = { get [f.actorId]() { trace.push("causes"); return causes; } };
  const qualification = captureDeathShotEligibility({
    get world() { trace.push("world"); return f.world; },
    get day(): number { throw new Error("native_day_must_not_read"); },
    get demonHunterNativeGunCurrent() {
      trace.push("demonCallee");
      return function(this: unknown) { expect(this).toBeUndefined(); trace.push("demon"); return demonAllowed; };
    },
  }, f.actorId, undefined, sources, Phase.Day, () => { trace.push("scope"); return true; });
  if (!qualification) throw new Error("native_fixture_missing");
  expect(qualification.nativePolicy).toBe("awa_qualified_sources_v1");
  expect(trace).toEqual(["world", "stock", "policy", "causes"]);
  trace.length = 0;
  expect(qualification.eligible()).toBe(false);
  expect(trace).toEqual(["demonCallee", "world", "demon"]);
  demonAllowed = true;
  trace.length = 0;
  expect(qualification.eligible()).toBe(true);
  expect(trace).toEqual([
    "demonCallee", "world", "demon", "scope", "world", "stock", "policy", "causes", "causes", "canShoot",
  ]);
  canShoot = false;
  expect(qualification.permissionCurrent()).toBe(true);
  expect(qualification.eligible()).toBe(false);
  policy = "awa_knife_or_exile_v1";
  trace.length = 0;
  expect(qualification.eligible()).toBe(false);
  expect(trace).toEqual(["demonCallee", "world", "demon", "scope", "world", "stock", "policy"]);
  policy = "awa_qualified_sources_v1";
  causes = [DeathCause.Exile, DeathCause.Poison];
  trace.length = 0;
  expect(qualification.permissionCurrent()).toBe(false);
  expect(trace).toEqual(["demonCallee", "world", "demon", "scope", "world", "stock", "policy", "causes"]);
});

test("a Hunter holding a real gift still checks Demon but never captures the native stock or pays", () => {
  const f = hunter(), fromId = f.world.createEntity(), events: GameEvent[] = [], trace: string[] = [];
  f.world.addComponent(fromId, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
  f.world.addComponent(fromId, COMPONENT.Alive, createAliveComponent());
  Object.defineProperty(f.role.privateState, "hunter", { get() { throw new Error("gift_native_stock_must_not_read"); } });
  const gun = grantDeathGun(f.world, fromId, f.actorId, 2, events);
  armDeathGun(f.world, f.actorId, gun, 2, events);
  f.world.getComponent(f.actorId, COMPONENT.Alive)!.alive = false;
  let allowed = false;
  const qualification = captureDeathShotEligibility({
    world: f.world, day: 2,
    get demonHunterNativeGunCurrent() {
      trace.push("demonCallee");
      return () => { trace.push("demon"); return allowed; };
    },
  }, f.actorId, gun.id, { [f.actorId]: [DeathCause.Exile] }, Phase.Night, () => { trace.push("scope"); return true; });
  if (!qualification) throw new Error("gift_fixture_missing");
  expect(qualification.nativePolicy).toBe("awa_qualified_sources_v1");
  expect(qualification.eligible()).toBe(false);
  expect(trace).toEqual(["demonCallee", "demon"]);
  allowed = true;
  trace.length = 0;
  expect(qualification.eligible()).toBe(true);
  expect(trace).toEqual(["demonCallee", "demon", "scope"]);
  expect(gun.remaining).toBe(1);
  expect(gun.deathExpired).toBe(false);
  expect(events.map(e => e.type)).toEqual(["death_ability_changed", "death_ability_changed"]);
});
