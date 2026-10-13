/**
 * 单元测试：验证明辉／黯月跨 await 资格边界。
 * 输入为原内存 fixture、callback 和显式非法变更；引用、状态、错误与字面预期是独立 oracle。
 * 实际原生 owner/frame/readers 仍按原顺序执行，use/install 入口只随实际实例 owner 迁移。
 * 不运行完整对局、模型或物理传输，不重建 fixture、矩阵或生产生成的预期。
 */
import { createAliveComponent, createCampComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { Role, Camp, WitchSelfHealRule } from "../../../../src/core/domain/identity";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { type AliveComponent } from "../../../../src/core/domain/components/alive";

import { createIdentityComponent } from "../../../../src/core/domain/entities/player";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import { installNativeAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import { createEclipseState } from "../../../../src/game/mechanisms/roles/radiant_eclipse/state";
import { createShelterState } from "../../../../src/game/mechanisms/roles/radiant_eclipse/shelter-state";
import {
  installRadiantEclipseBoard,
  beginRadiantNight,
  openEclipseChoice,
  commitEclipseChoice,
  captureRadiantTurn,
  closeRadiantNight,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/night_frame";
function fixture() {
  const world = new World(),
    roles = [
      Role.EclipseMaid,
      Role.RadiantCount,
      Role.Witch,
      Role.Seer,
      Role.Dreamer,
      Role.Wolf,
      Role.Wolf,
      Role.Wolf,
      Role.Villager,
      Role.Villager,
      Role.Villager,
      Role.Villager,
    ];
  const components = roles.map((kind, index) => {
    const id = world.createEntity(),
      camp = [Role.EclipseMaid, Role.Wolf].includes(kind) ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(kind, camp);
    if (kind === Role.EclipseMaid) {
      (role.privateState as Record<string, unknown>).eclipse = createEclipseState();
      (role.privateState as Record<string, unknown>).abilities = {};
    }
    if (kind === Role.RadiantCount) installNativeAbility(role, "shelter", createShelterState());
    if (kind === Role.Witch)
      installNativeAbility(role, "potion", {
        heal: 1,
        poison: 1,
        selfHealRule: WitchSelfHealRule.Disabled,
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      });
    if (kind === Role.Seer)
      installNativeAbility(role, "seer_check", {
        lastTarget: null,
        lastIsWerewolf: null,
        history: [],
      });
    if (kind === Role.Dreamer)
      installNativeAbility(role, "dream", {
        lastTarget: null,
        lastDay: null,
        history: [],
        protectionPolicy: "netease_2026_night_immunity_v1",
      });
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(
      id,
      COMPONENT.Identity,
      createIdentityComponent(id, index + 1, `Synthetic ${id}`),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    return role;
  });
  installRadiantEclipseBoard(world);
  beginRadiantNight(world, 2);
  openEclipseChoice(world, 2);
  commitEclipseChoice(world, 2, 3, []);
  const borrowed = findNightAbility(components[0], "potion")!,
    native = findNightAbility(components[2], "potion")!;
  return { world, components, borrowed, native };
}
test("legitimate borrowed stock consumption does not alter original source inventory", () => {
  const f = fixture();
  expect(f.borrowed.state).not.toBe(f.native.state);
  (f.borrowed.state as { heal: number }).heal = 0;
  expect(f.native.state.heal).toBe(1);
  closeRadiantNight(f.world, 2, "committed", []);
  expect(f.native.state.heal).toBe(1);
  expect(f.native.nightSuppression).toBeUndefined();
});
for (const mode of ["heal", "poison", "uses", "lastUsedDay"] as const)
  test(`borrowed await revokes when original source ${mode} changes`, () => {
    const f = fixture(),
      current = captureRadiantTurn(f.world, 1, f.borrowed, 2);
    expect(current()).toBe(true);
    if (mode === "heal" || mode === "poison")
      (f.native.state as import("@ai-werewolf-arena/game-contract").WitchState)[mode] = 0;
    else if (mode === "uses") (f.native as { uses: number }).uses++;
    else (f.native as { lastUsedDay: number | null }).lastUsedDay = 2;
    expect(current()).toBe(false);
  });
for (const mode of ["replacement", "revival"] as const)
  test(`close cannot disable borrowed ability retained by ${mode} maid life`, () => {
    const f = fixture();
    if (mode === "replacement") f.world.addComponent(1, COMPONENT.Alive, createAliveComponent());
    else {
      const life = f.world.getComponent(1, COMPONENT.Alive)!;
      life.alive = false;
      life.alive = true;
    }
    closeRadiantNight(f.world, 2, "aborted", []);
    expect(f.borrowed.disabled).toBe(false);
    expect(f.native.nightSuppression).toBeUndefined();
  });
for (const field of ["state", "source"] as const)
  test(`borrowed await revokes accessor replacement of ${field} without invoking it`, () => {
    const f = fixture(),
      current = captureRadiantTurn(f.world, 1, f.borrowed, 2),
      original = f.borrowed[field];
    let calls = 0;
    Object.defineProperty(f.borrowed, field, {
      enumerable: true,
      configurable: true,
      get() {
        calls++;
        return original;
      },
    });
    expect(current()).toBe(false);
    expect(calls).toBe(0);
  });
