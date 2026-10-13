/**
 * 单元测试：验证明辉／黯月已付效果边界。
 * 输入为原内存 fixture、callback 和显式非法变更；引用、状态、错误与字面预期是独立 oracle。
 * 实际原生 owner/frame/readers 仍按原顺序执行，use/install 入口只随实际实例 owner 迁移。
 * 不运行完整对局、模型或物理传输，不重建 fixture、矩阵或生产生成的预期。
 */
import { createAliveComponent, createCampComponent } from "../../../../src/game/observation/component-presentation";
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { Role, Camp, WitchSelfHealRule } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { type RoleComponent } from "../../../../src/core/domain/components/role";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";


import { createVictoryComponent } from "../../../../src/core/domain/components/victory";
import {
  findNightAbility,
  abilityStatus,
  type NightAbility,
} from "../../../../src/game/mechanisms/roles/abilities";
import { installNativeAbility } from "../../../../src/game/mechanisms/roles/ability_changes";
import {
  createEclipseState,
  createShelterState,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/state";
import {
  installRadiantEclipseBoard,
  beginRadiantNight,
  openEclipseChoice,
  commitEclipseChoice,
  captureRadiantTurn,
  closeRadiantNight,
  commitRadiantShelter,
  sealRadiantNightEffects,
} from "../../../../src/game/mechanisms/roles/radiant_eclipse/night_frame";
import type { GameEvent } from "../../../../src/core/domain/events";
function fixture() {
  const world = new World();
  const roles = [
    Role.EclipseMaid,
    Role.RadiantCount,
    Role.Seer,
    Role.Witch,
    Role.Dreamer,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Villager,
    Role.Wolf,
    Role.Wolf,
    Role.Wolf,
  ];
  for (const kind of roles) {
    const id = world.createEntity(),
      camp = kind === Role.EclipseMaid || kind === Role.Wolf ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(kind, camp);
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.Identity, {
      id,
      seat: id,
      name: `synthetic-${id}`,
      sessionId: "synthetic",
    });
    if (kind === Role.EclipseMaid) {
      (role.privateState as Record<string, unknown>).eclipse = createEclipseState();
      (role.privateState as Record<string, unknown>).abilities = {};
    }
    if (kind === Role.RadiantCount) installNativeAbility(role, "shelter", createShelterState());
    if (kind === Role.Seer)
      installNativeAbility(role, "seer_check", {
        lastTarget: null,
        lastIsWerewolf: null,
        history: [],
      });
    if (kind === Role.Witch)
      installNativeAbility(role, "potion", {
        heal: 1,
        poison: 0,
        selfHealRule: WitchSelfHealRule.Disabled,
        canSelfHeal: false,
        healUsedThisNight: false,
        poisonUsedThisNight: false,
      });
    if (kind === Role.Dreamer)
      installNativeAbility(role, "dream", {
        lastTarget: 6,
        lastDay: 1,
        history: [{ day: 1, targetId: 6 }],
        protectionPolicy: "netease_2026_night_immunity_v1",
      });
  }
  const role = (id: number) => world.getComponent(id, COMPONENT.Role)!;
  const events: GameEvent[] = [];
  installRadiantEclipseBoard(world);
  beginRadiantNight(world, 2);
  openEclipseChoice(world, 2);
  return { world, role, events };
}
test("a paid shelter cannot protect a replacement target identity on the original alive component", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 2, f.events);
  const borrowed = findNightAbility(f.role(1), "shelter")!;
  commitRadiantShelter(f.world, 2, 1, borrowed, 6, f.events);
  const effects = sealRadiantNightEffects(f.world, 2);
  closeRadiantNight(f.world, 2, "committed", f.events);
  const previous = f.role(6);
  f.world.addComponent(6, COMPONENT.Role, {
    ...previous,
    privateState: { ...previous.privateState },
  });
  expect(effects.shelters[0]!.isCurrent()).toBe(false);
});
test("aborted night retains the fact but does not leave handed-out paid effects eligible for settlement", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 2, f.events);
  const borrowed = findNightAbility(f.role(1), "shelter")!;
  commitRadiantShelter(f.world, 2, 1, borrowed, 6, f.events);
  const effects = sealRadiantNightEffects(f.world, 2);
  closeRadiantNight(f.world, 2, "aborted", f.events);
  expect(f.events.some((e) => e.type === "radiant_shelter_chosen")).toBe(true);
  expect(effects.shelters[0]!.isCurrent()).toBe(false);
  expect(effects.backlashes[0]!.isCurrent()).toBe(false);
});
