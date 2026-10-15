/**
 * 单元测试：验证明辉／黯月原生实例绑定边界。
 * 输入为原内存 fixture、callback 和显式非法变更；引用、状态、错误与字面预期是独立 oracle。
 * 实际原生 owner/frame/readers 仍按原顺序执行，use/install 入口只随实际实例 owner 迁移。
 * 不运行完整对局、模型或物理传输，不重建 fixture、矩阵或生产生成的预期。
 */
import {
  createAliveComponent,
  createCampComponent,
} from "../../../../src/agents/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/domain/world";
import { COMPONENT } from "../../../../src/domain/components/names";
import { Role, Camp, WitchSelfHealRule } from "../../../../src/domain/identity";
import { createRoleComponent } from "../../../../src/agents/observation/role-presentation";
import { type AliveComponent } from "../../../../src/domain/components/alive";

import { createIdentityComponent } from "../../../../src/domain/entities/player";
import { findNightAbility } from "../../../../src/features/night-abilities/abilities";
import { installNativeAbility } from "../../../../src/features/night-abilities/ability-changes";
import { createEclipseState } from "../../../../src/features/radiant-eclipse/eclipse-state-slot";
import { createShelterState } from "../../../../src/features/radiant-eclipse/shelter-state";
import {
  installRadiantEclipseBoard,
  beginRadiantNight,
  openEclipseChoice,
  commitEclipseChoice,
  captureRadiantTurn,
  closeRadiantNight,
} from "../../../../src/features/radiant-eclipse/night-frame";
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
      role = createRoleComponent(kind);
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

for (const mutation of ["kind", "source"] as const)
  test(`captured native ownership rejects same-instance ${mutation} changes before a new turn`, () => {
    const f = fixture(),
      count = findNightAbility(f.components[1], "shelter")!;
    expect(captureRadiantTurn(f.world, 2, count, 2)()).toBe(true);
    if (mutation === "kind") Object.assign(count, { kind: "potion", state: { ...f.native.state } });
    else Object.assign(count, { source: { kind: "gift", actorId: 6 } });
    let authorized = false;
    try {
      authorized = captureRadiantTurn(f.world, 2, count, 2)();
    } catch {}
    expect(authorized).toBe(false);
  });
