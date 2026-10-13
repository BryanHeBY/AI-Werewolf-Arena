/**
 * Unit tests for radiant-eclipse; Isolated radiant-eclipse lifecycle contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { Role, Camp, WitchSelfHealRule } from "../../../../src/core/domain/identity";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import {
  createRoleComponent,
  type RoleComponent,
} from "../../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { createCampComponent } from "../../../../src/core/domain/components/camp";
import { createVictoryComponent } from "../../../../src/core/domain/components/victory";
import {
  installNativeAbility,
  findNightAbility,
  abilityStatus,
  type NightAbility,
} from "../../../../src/game/mechanisms/roles/abilities";
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
  const role = (id: number) => world.getComponent<RoleComponent>(id, COMPONENT.Role)!;
  const events: GameEvent[] = [];
  installRadiantEclipseBoard(world);
  beginRadiantNight(world, 2);
  openEclipseChoice(world, 2);
  return { world, role, events };
}
test("changing original Witch inventory while a borrowed turn awaits revokes the old turn", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 4, f.events);
  const borrowed = findNightAbility(f.role(1), "potion")!,
    source = findNightAbility(f.role(4), "potion")!,
    valid = captureRadiantTurn(f.world, 1, borrowed, 2);
  expect(valid()).toBe(true);
  (source.state as { heal: number }).heal = 0;
  expect(valid()).toBe(false);
});
test("closing borrowed authorization owns its captured slot even after the instance id mutates", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 4, f.events);
  const borrowed = findNightAbility(f.role(1), "potion")!,
    slot = borrowed.id;
  (borrowed as { id: string }).id = "copy:mutated";
  closeRadiantNight(f.world, 2, "aborted", f.events);
  expect(
    (
      (f.role(1).privateState as { readonly abilities?: unknown }).abilities as Record<
        string,
        NightAbility
      >
    )[slot],
  ).toBe(borrowed);
  expect(borrowed.disabled).toBe(true);
  expect(abilityStatus(borrowed, 2)).toBe("disabled");
});
test("normal close cannot publish original-native restoration for a replaced source resource", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 4, f.events);
  const source = findNightAbility(f.role(4), "potion")!,
    replacement = {
      ...source,
      state: { ...source.state },
      nightSuppression: { ...source.nightSuppression! },
    };
  (
    (f.role(4).privateState as { readonly abilities?: unknown }).abilities as Record<
      string,
      NightAbility
    >
  )[source.id] = replacement;
  closeRadiantNight(f.world, 2, "committed", f.events);
  expect(replacement.nightSuppression).toBeDefined();
  expect(f.events.filter((e) => e.type === "eclipse_native_restored")).toEqual([]);
});
test("valid borrowed potion owns an independent stock, its authority closes and native stock survives", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 4, f.events);
  const borrowed = findNightAbility(f.role(1), "potion")!,
    source = findNightAbility(f.role(4), "potion")!;
  expect(borrowed.state).not.toBe(source.state);
  expect([borrowed.state.heal, borrowed.state.poison, borrowed.uses, borrowed.lastUsedDay]).toEqual(
    [1, 0, 0, null],
  );
  (borrowed.state as { heal: number }).heal = 0;
  (borrowed.state as { healUsedThisNight: boolean }).healUsedThisNight = true;
  (borrowed as { uses: number }).uses = 1;
  (borrowed as { lastUsedDay: number | null }).lastUsedDay = 2;
  closeRadiantNight(f.world, 2, "committed", f.events);
  expect([source.state.heal, source.state.poison, source.state.healUsedThisNight]).toEqual([
    1,
    0,
    false,
  ]);
  expect(borrowed.disabled).toBe(true);
  expect(source.nightSuppression).toBeUndefined();
});
test("a paid borrowed shelter keeps its original-body effect after normal authorization closes", () => {
  const f = fixture();
  commitEclipseChoice(f.world, 2, 2, f.events);
  const borrowed = findNightAbility(f.role(1), "shelter")!;
  commitRadiantShelter(f.world, 2, 1, borrowed, 6, f.events);
  const effects = sealRadiantNightEffects(f.world, 2);
  closeRadiantNight(f.world, 2, "committed", f.events);
  expect(borrowed.disabled).toBe(true);
  expect(effects.shelters).toHaveLength(1);
  expect(effects.shelters[0]!.isCurrent()).toBe(true);
  expect(effects.shelters[0]!.target.id).toBe(6);
  expect(effects.backlashes).toHaveLength(1);
});
