/**
 * 单元测试负责区分身份安装失败后的行动退休与原体／已付效果当前性。
 * 输入为真实首夜选择、本族榜样首死、原安装／准备／发表故障，以及实际原生枪结算边界。
 * 字面预期核同 Error、对象与库存前缀；字段恢复及同对象跨 World 不恢复行动，目标数据仍可读。
 * 原已付 Fox 谓词和消费后的延期枪提案不因墓碑取消；只运行本族贡献／共享结算，不跑整局或模型。
 * Fox 提案在独立合法板中消费显式 Wild owner 回调，只核已付谓词边界，不授予跨板行动或扩角色组合。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Camp, COMPONENT, DeathCause, Phase, Role, type GameEvent } from "../../../../src/domain";
import { World } from "../../../../src/domain/world";
import { createAliveComponent } from "../../../../src/domain/components/alive";
import { createRoleComponent } from "../../../../src/domain/components/role";
import { captureNightLife } from "../../../../src/domain/night-effects";
import { isRoleExecutionRetired, retireRoleExecution } from "../../../../src/domain/role-execution-authority";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { captureNightAbilityScope } from "../../../../src/game/mechanisms/roles/ability_scope";
import { grantNightAbility } from "../../../../src/game/mechanisms/roles/night-ability-grants";
import { findNightAbility, recordNightAbilityUse } from "../../../../src/game/mechanisms/roles/abilities";
import { captureDeathShotEligibility } from "../../../../src/game/mechanisms/roles/death-shot-eligibility";
import { commitFoxInspection } from "../../../../src/game/mechanisms/roles/cursed_fox/inspection_effect";
import { getHunterState, setHunterState } from "../../../../src/game/mechanisms/roles/native-death-gun-resources";
import { resolveNativeDeathShots, type NativeDeathShotRules } from "../../../../src/game/mechanisms/roles/native-death-shot-settlement";
import {
  recordWildChildDeathCommit,
  resolveWildChildDeathWave,
  validWildChildOwner,
  wildChildBinding,
} from "../../../../src/game/mechanisms/roles/wild_child/lifecycle";
import { WildChildSetupWindow } from "../../../../src/game/mechanisms/roles/wild_child/setup";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";
import { nightStageContext } from "../../../support/builders/night-stage-context";

/** 实际 canonical 配置完成选择后装一份独立赠予查验；不修改 Wild 槽或伪造其生命周期绑定。 */
async function prepared() {
  const roles = [Role.WildChild, Role.Wolf, Role.Wolf, Role.Seer, Role.Witch, Role.Hunter];
  const game = bootstrapGame(foxBoard(roles), { fixedRoles: roles });
  const events: GameEvent[] = [];
  const ready = await new WildChildSetupWindow(game.world, new ToolGateway(), events, {
    get requestFactory() { return GameActionRequestFactory; },
  }).execute(game.boardConfig, {
    async getAction() { return { name: "choose_wild_model", args: { target_id: 2 } }; },
  }, 1, () => true);
  if (!ready) throw new Error("literal_f05a_setup_expected_success");
  const binding = wildChildBinding(game.world)!;
  const ability = grantNightAbility(game.world, 1, {
    id: "gift:f05a-night", kind: "seer_check",
    state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] },
    source: { kind: "gift", actorId: 4 }, startsOnDay: 1, maxUses: null,
  }, events);
  const scope = captureNightAbilityScope(game.world, 1, ability, 1, () => true)!;
  // 两族不支持同板：Fox 使用原合法独立 roster，真实提案只消费下面显式传入的原 owner 谓词。
  // 单独已付实例记 use；未付实例仍可行动，避免把资源已用导致的 false 冒成墓碑拒绝。
  const paidAbility = grantNightAbility(game.world, 1, {
    id: "gift:f05a-paid-fox", kind: "seer_check",
    state: { lastTarget: null, lastIsWerewolf: null, lastResult: null, history: [] },
    source: { kind: "gift", actorId: 4 }, startsOnDay: 1, maxUses: 1,
  }, events);
  const paidScope = captureNightAbilityScope(game.world, 1, paidAbility, 1, () => true)!;
  recordNightAbilityUse(paidAbility, 1, true);
  const foxRoles = [Role.CursedFox, Role.Seer, Role.Wolf, Role.Witch, Role.Guard, Role.Villager];
  const foxGame = bootstrapGame(foxBoard(foxRoles), { fixedRoles: foxRoles });
  const ctx = nightStageContext({ world: foxGame.world });
  commitFoxInspection(foxGame.world, ctx.state, captureNightLife(foxGame.world, 1)!, 1, () => paidScope.isOwnerCurrent(true));
  const paidFox = ctx.state.foxInspections![0]!;
  recordWildChildDeathCommit(game.world, 2);
  game.world.getComponent(2, COMPONENT.Alive)!.alive = false;
  return { ...game, events, binding, ability, scope, paidAbility, paidScope, paidFox };
}

const contribute = (g: Awaited<ReturnType<typeof prepared>>) =>
  resolveWildChildDeathWave(g.world, [2], { 2: [DeathCause.Poison] }, 1, Phase.Night, g.events);

/** Wild 没有原生枪；只检查公开选择资格的无 gift／nativeState 分支，不声称因此拥有枪或死亡许可。 */
function selection(world: World) {
  return captureDeathShotEligibility({
    world, day: 1,
    get demonHunterNativeGunCurrent(): (world: World, actorId: number) => boolean { throw new Error("literal_non_hunter_query_must_not_be_read"); },
  }, 1, undefined, { 1: [DeathCause.Shot] }, Phase.Day, () => true);
}

test("Wild Camp failure permanently retires old and fresh action captures across World aliases while data stays readable", async () => {
  const g = await prepared(), role = g.binding.actor.role;
  const original = g.world.addComponent, camp = g.binding.camp, error = new Error("literal_f05a_camp_failure");
  const actorDescriptor = Object.getOwnPropertyDescriptor(g.binding, "actor")!;
  const before = selection(g.world)!;
  const other = new World(), id = other.createEntity();
  other.addComponent(id, COMPONENT.Role, role);
  other.addComponent(id, COMPONENT.Camp, { camp: Camp.Good });
  other.addComponent(id, COMPONENT.Alive, createAliveComponent(true));
  const otherScope = captureNightAbilityScope(other, id, g.ability, 1, () => true)!;
  expect(g.scope.isEligible()).toBe(true);
  expect(before.eligible()).toBe(true);
  g.world.addComponent = new Proxy(original, {
    apply(target, receiver, args) {
      if (args[0] === 1 && args[1] === COMPONENT.Camp) {
        // 安装回调可改公开 binding；catch 必须消费已捕获 Role，不晚读这个抛错 getter。
        Object.defineProperty(g.binding, "actor", { configurable: true, get() { throw new Error("literal_catch_binding_read_must_not_happen"); } });
        throw error;
      }
      return Reflect.apply(target, receiver, args);
    },
  });
  let caught: unknown;
  try { contribute(g); } catch (e) { caught = e; } finally {
    g.world.addComponent = original;
    Object.defineProperty(g.binding, "actor", actorDescriptor);
  }
  expect(caught).toBe(error);
  expect(g.world.getComponent(1, COMPONENT.Camp)).toBe(camp);
  // F05b已退休Role镜像；本注入在Camp真正安装前抛，actual仍为旧Good。
  expect(camp.camp).toBe(Camp.Good);
  camp.camp = Camp.Wolf;
  camp.camp = Camp.Good;
  expect(isRoleExecutionRetired(role)).toBe(true);
  expect(validWildChildOwner(g.binding)).toBe(false);
  expect(g.scope.isOwnerCurrent()).toBe(true);
  expect(g.scope.isEligible()).toBe(false);
  expect(captureNightAbilityScope(g.world, 1, g.ability, 1, () => true)!.isEligible()).toBe(false);
  expect(before.permissionCurrent()).toBe(true);
  expect(before.eligible()).toBe(false);
  expect(selection(g.world)).toBeNull();
  expect(other.getComponent(id, COMPONENT.Role)).toBe(role);
  expect(otherScope.isOwnerCurrent()).toBe(true);
  expect(otherScope.isEligible()).toBe(false);
  expect(selection(other)).toBeNull();
  expect(findNightAbility(role, "seer_check", g.ability.id)).toBe(g.ability);
  expect(g.ability.uses).toBe(0);
  expect(g.paidAbility.uses).toBe(1);
  expect(g.paidFox.isCurrent()).toBe(true);
  expect(captureNightLife(other, id)?.life).toBe(other.getComponent(id, COMPONENT.Alive));
});

test("Wild core preparation failure keeps paid Fox currentness but refuses new action permission", async () => {
  const g = await prepared(), role = g.binding.actor.role;
  const camp = g.binding.camp, victory = g.binding.victory, error = new Error("literal_f05a_prepare_failure");
  const descriptor = Object.getOwnPropertyDescriptor(g.world, "locale")!;
  // 此原 getter 在准备Camp实参处首次抛，尚未安装任何新组件；区别于已提交的Camp安装故障旧例。
  Object.defineProperty(g.world, "locale", { configurable: true, get() { throw error; } });
  let caught: unknown;
  try { contribute(g); } catch (e) { caught = e; } finally { Object.defineProperty(g.world, "locale", descriptor); }
  expect(caught).toBe(error);
  expect(camp.camp).toBe(Camp.Good);
  expect(g.world.getComponent(1, COMPONENT.Camp)).toBe(camp);
  expect(g.world.getComponent(1, COMPONENT.Victory)).toBe(victory);
  expect(g.binding.state.status).toBe("chosen");
  expect(isRoleExecutionRetired(role)).toBe(true);
  expect(g.scope.isOwnerCurrent(true)).toBe(true);
  expect(g.paidScope.isOwnerCurrent(true)).toBe(true);
  expect(g.paidFox.isCurrent()).toBe(true);
  expect(g.scope.isEligible()).toBe(false);
  expect(selection(g.world)).toBeNull();
});

test("Wild transformed fact failure preserves committed execution and permits fresh action capture", async () => {
  const g = await prepared(), role = g.binding.actor.role;
  const original = g.events.push, error = new Error("literal_f05a_late_fact_failure");
  g.events.push = new Proxy(original, {
    apply(target, receiver, args) {
      if (args.some((event: GameEvent) => event.type === "wild_child_transformed")) throw error;
      return Reflect.apply(target, receiver, args);
    },
  });
  let caught: unknown;
  try { contribute(g); } catch (e) { caught = e; } finally { g.events.push = original; }
  expect(caught).toBe(error);
  expect(isRoleExecutionRetired(role)).toBe(false);
  expect(validWildChildOwner(g.binding)).toBe(true);
  expect(g.binding.state.status).toBe("transformed");
  expect(g.world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Wolf);
  expect(captureNightAbilityScope(g.world, 1, g.ability, 1, () => true)!.isEligible()).toBe(true);
  expect(selection(g.world)!.eligible()).toBe(true);
});

function hunter(trace: string[], stock: { isCurrent(): boolean; consume(): void } | null = null) {
  const world = new World(), actor = world.createEntity(), target = world.createEntity();
  const role = createRoleComponent(Role.Hunter), state = { canShoot: true };
  setHunterState(role, state);
  world.addComponent(actor, COMPONENT.Role, role);
  world.addComponent(actor, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(actor, COMPONENT.Alive, createAliveComponent(false));
  world.addComponent(target, COMPONENT.Role, createRoleComponent(Role.Villager));
  world.addComponent(target, COMPONENT.Camp, { camp: Camp.Good });
  world.addComponent(target, COMPONENT.Alive, createAliveComponent(true));
  const rules: NativeDeathShotRules = {
    role: Role.Hunter,
    state(actorRole) { trace.push("state"); return getHunterState(actorRole); },
    openHunterStock() { trace.push("stock"); return stock; },
    permits: () => true,
    shotEvent: (actorId, targetId) => ({ timestamp: 0, type: "hunter_shot", payload: { hunterId: actorId, targetId } }),
  };
  return { world, actor, target, role, state, rules };
}

test("native action retirement preserves stock error priority and already consumed pending shot currentness", async () => {
  // 实际 Hunter／World／结算，仅 stock 回执为字面边界替身；不冒真实 Demon 私账付款验收。
  const beforeTrace: string[] = [], pre = hunter(beforeTrace);
  retireRoleExecution(pre.role);
  const refused = await resolveNativeDeathShots(pre.world, [pre.actor], { [pre.actor]: [DeathCause.Poison] },
    async () => { throw new Error("literal_retired_actor_must_not_choose"); }, [], pre.rules);
  expect(beforeTrace).toEqual(["state"]);
  expect(pre.state.canShoot).toBe(true);
  expect(refused.extraDeaths).toEqual([]);

  const errorTrace: string[] = [], revoked = hunter(errorTrace, {
    isCurrent() { errorTrace.push("stock-current"); return false; },
    consume() { throw new Error("literal_revoked_stock_must_not_consume"); },
  });
  await expect(resolveNativeDeathShots(revoked.world, [revoked.actor], { [revoked.actor]: [DeathCause.Shot] },
    async () => { errorTrace.push("choose"); retireRoleExecution(revoked.role); return { kind: "pass", deathActionId: 0 }; },
    [], revoked.rules)).rejects.toThrow("demon_hunter_native_hunter_stock_revoked");
  expect(errorTrace).toEqual(["state", "stock", "choose", "stock-current"]);
  expect(revoked.state.canShoot).toBe(true);

  const lateTrace: string[] = [], late = hunter(lateTrace, {
    isCurrent() { lateTrace.push("stock-current"); return true; },
    consume() { throw new Error("literal_retired_after_wait_must_not_consume"); },
  });
  const latePermit = late.world.openDeathAction(late.actor, "shoot", Phase.Day, 1);
  try {
    const skipped = await resolveNativeDeathShots(late.world, [late.actor], { [late.actor]: [DeathCause.Shot] },
      async () => { lateTrace.push("choose"); retireRoleExecution(late.role); return { kind: "pass", deathActionId: latePermit.id }; },
      [], late.rules);
    expect(lateTrace).toEqual(["state", "stock", "choose", "stock-current", "state"]);
    expect(skipped.extraDeaths).toEqual([]);
    expect(late.state.canShoot).toBe(true);
  } finally { latePermit.close(); }

  const paid = hunter([]), permit = paid.world.openDeathAction(paid.actor, "shoot", Phase.Day, 1);
  try {
    const result = await resolveNativeDeathShots(paid.world, [paid.actor], { [paid.actor]: [DeathCause.Shot] },
      async () => ({ kind: "shot", targetId: paid.target, deathActionId: permit.id }), [], paid.rules,
      { day: 1, deathOriginPhase: Phase.Day, deferShotCommit: true, nightEffect: false, blocksNightShot: () => false });
    expect(paid.state.canShoot).toBe(false);
    expect(result.pendingShots).toHaveLength(1);
    expect(result.pendingShots![0]!.isCurrent!()).toBe(true);
    retireRoleExecution(paid.role);
    expect(result.pendingShots![0]!.isCurrent!()).toBe(true);
    expect(paid.world.isDeathActionOpen(paid.actor, "shoot", permit.id)).toBe(true);
    expect(getHunterState(paid.role)).toBe(paid.state);
  } finally { permit.close(); }
});

test("native mapping callback and canShoot getter retirement refuse unpaid consumption and eligibility", async () => {
  const trace: string[] = [], mapped = hunter(trace), events: GameEvent[] = [];
  const permit = mapped.world.openDeathAction(mapped.actor, "shoot", Phase.Day, 1);
  try {
    const result = await resolveNativeDeathShots(mapped.world, [mapped.actor], { [mapped.actor]: [DeathCause.Shot] },
      async () => {
        trace.push("choose");
        return {
          kind: "shot", targetId: mapped.target, deathActionId: permit.id,
          mappingCurrent() { trace.push("mapping"); retireRoleExecution(mapped.role); return true; },
        };
      }, events, mapped.rules,
      { day: 1, deathOriginPhase: Phase.Day, deferShotCommit: true, nightEffect: false, blocksNightShot: () => false });
    expect(trace).toEqual(["state", "stock", "choose", "state", "mapping"]);
    expect(isRoleExecutionRetired(mapped.role)).toBe(true);
    expect(mapped.state.canShoot).toBe(true);
    expect(result.extraDeaths).toEqual([]);
    expect(result.pendingShots).toBeUndefined();
    expect(events).toEqual([]);
  } finally { permit.close(); }

  const wide = hunter([]), reads: string[] = [];
  // 原裸 state 接受 accessor；只在原 eligible 读取处退休，不提前改变捕获或纯许可谓词。
  Object.defineProperty(wide.state, "canShoot", {
    configurable: true,
    get() { reads.push("canShoot"); retireRoleExecution(wide.role); return true; },
  });
  const captured = captureDeathShotEligibility({
    world: wide.world, day: 1, demonHunterNativeGunCurrent: () => true,
  }, wide.actor, undefined, { [wide.actor]: [DeathCause.Shot] }, Phase.Day, () => true)!;
  expect(reads).toEqual([]);
  expect(captured.eligible()).toBe(false);
  expect(reads).toEqual(["canShoot"]);
  expect(isRoleExecutionRetired(wide.role)).toBe(true);
  expect(captured.permissionCurrent()).toBe(true);
});
