/**
 * 单元测试：验证明辉／黯月属性描述符边界。
 * 输入为原内存 fixture、callback 和显式非法变更；引用、状态、错误与字面预期是独立 oracle。
 * 实际原生 owner/frame/readers 仍按原顺序执行，use/install 入口只随实际实例 owner 迁移。
 * 不运行完整对局、模型或物理传输，不重建 fixture、矩阵或生产生成的预期。
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { Role, Camp, WitchSelfHealRule } from "../../../../src/core/domain/identity";
import { createRoleComponent } from "../../../../src/core/domain/components/role";
import {
  createAliveComponent,
  type AliveComponent,
} from "../../../../src/core/domain/components/alive";
import { createCampComponent } from "../../../../src/core/domain/components/camp";
import { createIdentityComponent } from "../../../../src/core/domain/entities/player";
import { findNightAbility } from "../../../../src/game/mechanisms/roles/abilities";
import { installNativeAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import {
  createShelterState,
  createEclipseState,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/state";
import {
  installRadiantEclipseBoard,
  beginRadiantNight,
  openEclipseChoice,
  commitEclipseChoice,
  captureRadiantTurn,
  closeRadiantNight,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/night_frame";
function fixture(open = true, commit = true) {
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
  if (open) openEclipseChoice(world, 2);
  if (commit) commitEclipseChoice(world, 2, 3, []);
  const borrowed = findNightAbility(components[0], "potion")!,
    native = findNightAbility(components[2], "potion")!;
  return { world, components, borrowed, native };
}

import {
  commitRadiantShelter,
  sealRadiantNightEffects,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/night_frame";
for (const field of ["id", "source"] as const)
  test(`native ${field} getter after swallow request is rejected before any getter execution`, () => {
    const f = fixture(true, false),
      value = f.native[field];
    let calls = 0;
    Object.defineProperty(f.native, field, {
      enumerable: true,
      configurable: true,
      get() {
        calls++;
        return value;
      },
    });
    expect(() => commitEclipseChoice(f.world, 2, 3, [])).toThrow();
    expect(calls).toBe(0);
  });
for (const field of ["state", "source"] as const)
  test(`paid shelter ${field} getter revokes claim without executing a getter`, () => {
    const f = fixture(),
      count = findNightAbility(f.components[1], "shelter")!;
    commitRadiantShelter(f.world, 2, 2, count, 6, []);
    const effects = sealRadiantNightEffects(f.world, 2),
      claim = effects.shelters[0]!;
    expect(claim.isCurrent()).toBe(true);
    const value = count[field];
    let calls = 0;
    Object.defineProperty(count, field, {
      enumerable: true,
      configurable: true,
      get() {
        calls++;
        return value;
      },
    });
    const current = claim.isCurrent();
    expect({ current, calls }).toEqual({ current: false, calls: 0 });
  });
test("abort cleanup retires its original borrowed instance without executing a substituted disabled setter", () => {
  const f = fixture();
  let calls = 0;
  Object.defineProperty(f.borrowed, "disabled", {
    enumerable: true,
    configurable: true,
    get() {
      return false;
    },
    set(_v) {
      calls++;
    },
  });
  closeRadiantNight(f.world, 2, "aborted", []);
  expect({
    calls,
    disabled: Object.getOwnPropertyDescriptor(f.borrowed, "disabled")?.value,
  }).toEqual({ calls: 0, disabled: true });
});
