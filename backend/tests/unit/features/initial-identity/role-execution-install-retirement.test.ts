/**
 * 单元测试验证真实盗贼身份安装失败的执行退休政策：同 Good 换成预言家，注入字面安装／晚事实错误。
 * 预期直接核原 Error、物理牌引用、实际组件与库存、旧／新动作资格；不调用生产规则作为 oracle。
 * 三种安装失败各用独立新 World，旧角色不被退休，已付／纯原体查询与数据仍可读；完整安装后的晚发表错误不退休。
 * 只运行有界首夜设置窗口，不跑完整局、旧绿色测试、模型或私有配置。
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { Camp, Role, COMPONENT, type RoleComponent, type GameEvent } from "../../../../src/core";
import { isRoleExecutionRetired } from "../../../../src/core/domain/role-execution-authority";
import { allNightAbilities } from "../../../../src/game/mechanisms/roles/abilities";
import { captureNightAbilityScope } from "../../../../src/game/mechanisms/roles/ability_scope";
import { ThiefSetupWindow } from "../../../../src/game/mechanisms/roles/thief/setup";
import { initialIdentityStock } from "../../../../src/game/mechanisms/roles/initial_identity/deal";
import { GameActionRequestFactory } from "../../../../src/game/engine/action_request_factory";
import { ToolGateway } from "../../../../src/game/gateway/tool_gateway";
import { foxBoard } from "../../../support/features/cursed-fox/builders/scenario";

const cards = [Role.Thief, Role.Wolf, Role.Witch, Role.Hunter, Role.Villager, Role.Villager, Role.Wolf, Role.Seer];
function fixture() {
  const config = foxBoard([Role.Thief, Role.Wolf, Role.Witch, Role.Hunter, Role.Wolf, Role.Seer]);
  const { world } = bootstrapGame(config, { fixedRoles: cards });
  const events: GameEvent[] = [];
  const window = new ThiefSetupWindow(world, new ToolGateway(), events, {
    get requestFactory() { return GameActionRequestFactory; },
  });
  return { world, config, events, run: () => window.execute(config, {
    async getAction() { return { name: "choose_thief_card", args: { slot: 1 } }; },
  }, 1, () => true) };
}
function nightScope(world: ReturnType<typeof fixture>["world"], role: RoleComponent) {
  const ability = allNightAbilities(role).find((entry) => entry.kind === "seer_check");
  if (!ability) throw new Error("literal_fixture_seer_stock_missing");
  const scope = captureNightAbilityScope(world, 1, ability, 1, () => true);
  if (!scope) throw new Error("literal_fixture_night_scope_missing");
  return { ability, scope };
}

for (const failingInstall of ["Role", "Camp", "Victory"] as const) {
  test(`same-camp ${failingInstall} install failure retires only the candidate execution and preserves data`, async () => {
    const game = fixture(), { world } = game;
    const oldRole = world.getComponent(1, COMPONENT.Role)!;
    const oldCamp = world.getComponent(1, COMPONENT.Camp)!;
    const oldVictory = world.getComponent(1, COMPONENT.Victory)!;
    const stock = initialIdentityStock(world)!;
    const oldHand = stock.hands.get(1)!, chosen = stock.reserve[1]!;
    const error = new Error(`literal_initial_${failingInstall}_install_failure`);
    const original = world.addComponent;
    const observed: { candidate?: RoleComponent; scope?: ReturnType<typeof nightScope>["scope"] } = {};
    const trace: string[] = [];
    world.addComponent = function(this: typeof world, id: number, key: any, value: any) {
      if (id === 1 && key === COMPONENT.Role) observed.candidate = value;
      if (id === 1 && key === COMPONENT[failingInstall]) {
        trace.push(`${failingInstall}:throw`);
        throw error;
      }
      const result = original.call(this, id, key, value);
      if (id === 1 && key === COMPONENT.Role) {
        trace.push("Role:installed");
        observed.scope = nightScope(world, value).scope;
      } else if (id === 1 && key === COMPONENT.Camp) trace.push("Camp:installed");
      return result;
    } as typeof world.addComponent;
    let caught: unknown;
    try { await game.run(); } catch (failure) { caught = failure; }
    finally { world.addComponent = original; }
    const candidate = observed.candidate!;
    expect(caught).toBe(error);
    expect(candidate.role).toBe(Role.Seer);
    // 旧Role.camp已退休；失败前缀的真实阵营仍取当前Camp组件。
    expect(world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Good);
    expect(isRoleExecutionRetired(candidate)).toBe(true);
    expect(isRoleExecutionRetired(oldRole)).toBe(false);
    expect(stock.hands.get(1)).toBe(chosen);
    expect(stock.reserve[1]).toBe(oldHand);
    expect(stock.selection).toEqual({ actorId: 1, slot: 1, role: Role.Seer });
    expect(game.events).toEqual([]);
    expect(world.getComponent(1, COMPONENT.Victory)).toBe(oldVictory);
    if (failingInstall === "Role") {
      expect(trace).toEqual(["Role:throw"]);
      expect(world.getComponent(1, COMPONENT.Role)).toBe(oldRole);
      expect(world.getComponent(1, COMPONENT.Camp)).toBe(oldCamp);
    } else {
      expect(trace).toEqual(failingInstall === "Camp"
        ? ["Role:installed", "Camp:throw"]
        : ["Role:installed", "Camp:installed", "Victory:throw"]);
      expect(world.getComponent(1, COMPONENT.Role)).toBe(candidate);
      expect(world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Good);
      if (failingInstall === "Camp") expect(world.getComponent(1, COMPONENT.Camp)).toBe(oldCamp);
      // 同阵营和原引用仍匹配；失去的是执行许可，不是数据／已付效果的原体身份。
      expect(observed.scope!.isOwnerCurrent()).toBe(true);
      expect(observed.scope!.isEligible()).toBe(false);
      const fresh = nightScope(world, candidate);
      expect(fresh.scope.isOwnerCurrent()).toBe(true);
      expect(fresh.scope.isEligible()).toBe(false);
      expect(allNightAbilities(candidate)).toContain(fresh.ability);
      // 旧Role重复字段退出；恢复真实当前Camp仍不能清除同Role执行墓碑。
      game.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Wolf;
      game.world.getComponent(1, COMPONENT.Camp)!.camp = Camp.Good;
      expect(observed.scope!.isEligible()).toBe(false);
      expect(fresh.scope.isEligible()).toBe(false);
    }
  });
}

test("a late identity fact failure keeps the completely installed candidate execution", async () => {
  const game = fixture(), error = new Error("literal_late_identity_fact_failure");
  Object.defineProperty(game.events, "push", { get() { throw error; } });
  let caught: unknown;
  try { await game.run(); } catch (failure) { caught = failure; }
  const role = game.world.getComponent(1, COMPONENT.Role)!;
  expect(caught).toBe(error);
  expect(role.role).toBe(Role.Seer);
  expect(game.world.getComponent(1, COMPONENT.Camp)?.camp).toBe(Camp.Good);
  expect(game.world.getComponent(1, COMPONENT.Victory)?.affiliations).toEqual([{ kind: "faction", faction: Camp.Good }]);
  expect(isRoleExecutionRetired(role)).toBe(false);
  const { scope } = nightScope(game.world, role);
  expect(scope.isOwnerCurrent()).toBe(true);
  expect(scope.isEligible()).toBe(true);
  expect(game.events.length).toBe(0);
});
