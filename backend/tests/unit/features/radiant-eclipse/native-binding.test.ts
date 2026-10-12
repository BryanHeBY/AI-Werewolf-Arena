/**
 * Unit tests for radiant-eclipse; Isolated radiant-eclipse native-binding contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
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
import {
  installNativeAbility,
  findNightAbility,
} from "../../../../src/game/mechanisms/roles/abilities";
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
      role.privateState.eclipse = createEclipseState();
      role.privateState.abilities = {};
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
