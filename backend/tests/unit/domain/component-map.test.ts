/**
 * Unit contract for World's typed component slots and unchanged reference/life
 * ownership. Literal eleven-name order, original object identity and explicit
 * death-permission revisions are independent runtime oracles. Compiler positive
 * and @ts-expect-error examples cover default slot inference and the temporary
 * explicit legacy escape; no role rules, transport or serialized handles change.
 */
import { expect, test } from "bun:test";
import {
  COMPONENT,
  Camp,
  Phase,
  Role,
  World,
  aliveLifeVersion,
  createAliveComponent,
  createCampComponent,
  createIdentityComponent,
  createRoleComponent,
  type AliveComponent,
  type CampComponent,
  type ComponentMap,
  type ComponentName,
  type RoleComponent,
} from "../../../src/core";

function compilerExamples(world: World, actorId: number) {
  const alive = createAliveComponent(),
    camp = createCampComponent(Camp.Good),
    role = createRoleComponent(Role.Villager, Camp.Good);
  world.addComponent(actorId, COMPONENT.Alive, alive);
  world.addComponent(actorId, COMPONENT.Camp, { ...camp, customExtra: { original: true } });
  world.addComponent(actorId, COMPONENT.Role, { ...role, customExtra: "unchanged width" });
  const inferred: AliveComponent | undefined = world.getComponent(actorId, COMPONENT.Alive);
  if (inferred) {
    const aliveFlag: boolean = inferred.alive;
    // @ts-expect-error Alive's default mapped subtype has no role-private state.
    inferred.privateState;
    void aliveFlag;
  }
  // @ts-expect-error Wrong default slot cannot infer a legacy T from the value.
  world.addComponent(actorId, COMPONENT.Alive, camp);
  // @ts-expect-error Camp does not satisfy Role's component shape.
  world.addComponent(actorId, COMPONENT.Role, camp);
  // @ts-expect-error Role's exclusive fields cannot occupy Camp's slot.
  world.addComponent(actorId, COMPONENT.Camp, role);
  // @ts-expect-error Missing original required fields cannot use a default legacy fallback.
  world.addComponent(actorId, COMPONENT.Role, { role: Role.Wolf, camp: Camp.Wolf });
  // @ts-expect-error A contextual return type cannot infer the legacy getter T.
  const wrong: CampComponent | undefined = world.getComponent(actorId, COMPONENT.Alive);
  const unionName: typeof COMPONENT.Role | typeof COMPONENT.Camp =
    actorId > 1 ? COMPONENT.Role : COMPONENT.Camp;
  // @ts-expect-error Value inference cannot widen a named union to the Alive slot.
  world.addComponent(actorId, unionName, alive);
  // @ts-expect-error Actor IDs remain numbers; arbitrary actor arguments cannot enter a slot.
  world.addComponent("actor", COMPONENT.Alive, alive);
  // @ts-expect-error Unknown source arguments do not become an entity ID.
  world.getComponent({ actorId }, COMPONENT.Role);
  // @ts-expect-error A machine slot name remains a closed eleven-name set.
  world.getComponent(actorId, "ForeignComponent");
  // C44 must remove these explicit unchecked type-argument overloads after callers migrate.
  const legacy: RoleComponent | undefined = world.getComponent<RoleComponent>(
    actorId,
    COMPONENT.Camp,
  );
  world.addComponent<RoleComponent>(actorId, COMPONENT.Camp, role);
  type SameKeys = keyof ComponentMap extends ComponentName
    ? ComponentName extends keyof ComponentMap
      ? true
      : false
    : false;
  const closedMap: SameKeys = true;
  void [wrong, legacy, closedMap];
}
void compilerExamples;

test("eleven existing slot IDs and inferred reads preserve mutable original references", () => {
  expect(Object.values(COMPONENT)).toEqual([
    "IdentityComponent",
    "RoleComponent",
    "CampComponent",
    "AliveComponent",
    "VotingRightComponent",
    "StatusMarksComponent",
    "BadgeComponent",
    "VictoryComponent",
    "LoversComponent",
    "WallNoteComponent",
    "DebatePenaltyComponent",
  ]);
  expect(Object.isFrozen(COMPONENT)).toBe(false);
  const world = new World(),
    actorId = world.createEntity(),
    identity = createIdentityComponent(actorId, 1, "Raw {player} name"),
    role = createRoleComponent(Role.Villager, Camp.Good),
    camp = createCampComponent(Camp.Good);
  expect(world.getComponent(actorId, COMPONENT.Identity)).toBeUndefined();
  world.addComponent(actorId, COMPONENT.Identity, identity);
  world.addComponent(actorId, COMPONENT.Role, role);
  world.addComponent(actorId, COMPONENT.Camp, camp);
  expect(world.getComponent(actorId, COMPONENT.Identity)).toBe(identity);
  expect(world.getComponent(actorId, COMPONENT.Role)).toBe(role);
  expect(world.getComponent(actorId, COMPONENT.Camp)).toBe(camp);
  world.getComponent(actorId, COMPONENT.Identity)!.name = "Untranslated name";
  expect(identity.name).toBe("Untranslated name");
  world.removeComponent(actorId, COMPONENT.Identity);
  expect(world.getComponent(actorId, COMPONENT.Identity)).toBeUndefined();
  expect(world.hasEntity(actorId)).toBe(true);
});

test("typed Alive reads retain original factory life revisions and death-permission retirement", () => {
  const world = new World(),
    actorId = world.createEntity(),
    life = createAliveComponent(false);
  world.addComponent(actorId, COMPONENT.Role, createRoleComponent(Role.Hunter, Camp.Good));
  world.addComponent(actorId, COMPONENT.Alive, life);
  const original = world.openDeathAction(actorId, "shoot", Phase.Day, 1);
  expect(world.getComponent(actorId, COMPONENT.Alive)).toBe(life);
  expect(world.hasDeathAction(actorId, "shoot", Phase.Day, 1, original.id)).toBe(true);
  world.getComponent(actorId, COMPONENT.Alive)!.alive = true;
  world.getComponent(actorId, COMPONENT.Alive)!.alive = false;
  expect(aliveLifeVersion(life)).toBe(2);
  expect(world.hasDeathAction(actorId, "shoot", Phase.Day, 1, original.id)).toBe(false);
  const later = world.openDeathAction(actorId, "shoot", Phase.Day, 1);
  original.close();
  expect(world.hasDeathAction(actorId, "shoot", Phase.Day, 1, later.id)).toBe(true);
  const replacement = createAliveComponent(false);
  world.addComponent(actorId, COMPONENT.Alive, replacement);
  expect(world.getComponent(actorId, COMPONENT.Alive)).toBe(replacement);
  expect(aliveLifeVersion(replacement)).toBe(0);
  expect(world.hasDeathAction(actorId, "shoot", Phase.Day, 1, later.id)).toBe(false);
  expect(world.activeDeathActionCount).toBe(0);
});

test("typed signatures leave original invalid-locale and missing-entity errors intact", () => {
  // Runtime invalid input is deliberate here; factories keep their original checks.
  expect(() => new World("unsupported" as "en")).toThrow("game_locale_invalid");
  const world = new World();
  expect(() => world.addComponent(99, COMPONENT.Alive, createAliveComponent())).toThrow(
    "Entity 99 does not exist",
  );
  expect(world.getComponent(99, COMPONENT.Alive)).toBeUndefined();
});
