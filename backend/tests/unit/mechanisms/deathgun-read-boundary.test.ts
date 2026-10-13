/**
 * Unit tests for granted death-gun read references and original life/transfer ownership.
 * Inputs are literal Role/Alive components, grant/arm/transfer commands and an
 * accessor-backed stock field; identity, first-death rows and write traces are
 * independent oracles. Compile-only valid-field mutations must be denied through
 * read outputs. No game, model, transport or generated expected data runs here.
 */
import "../../../src/app/bootstrap";
import { expect, test } from "bun:test";
import { Camp, Role, type DeathGunReadView } from "@ai-werewolf-arena/game-contract";
import { World } from "../../../src/core/domain/world";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { createRoleComponent } from "../../../src/core/domain/components/role";
import { createAliveComponent } from "../../../src/core/domain/components/alive";
import {
  allDeathGuns,
  findDeathGun,
  activeDeathGun,
  grantDeathGun,
  armDeathGun,
  transferDeathGun,
  firstDeathGuns,
  finishDeathGuns,
  deathGunOwnerCurrent,
  consumeDeathGunShot,
} from "../../../src/game/mechanisms/roles/death_abilities";

function forbiddenReaderWrites(gun: DeathGunReadView) {
  // @ts-expect-error Inventory metadata is owned by concrete gun commands.
  gun.disabled = true;
  // @ts-expect-error Armed-night metadata is not an ordinary read write surface.
  gun.armedOnNight = 2;
  // @ts-expect-error Finite single-use stock belongs to the actual gun owner.
  gun.remaining = 0;
  // @ts-expect-error First-death expiry is owner data, not reader metadata.
  gun.deathExpired = true;
  // @ts-expect-error Source metadata stays readonly below the instance.
  gun.source.actorId = 2;
  if (gun.source.kind === "transfer") {
    // @ts-expect-error Transfer origin IDs cannot be changed through a read alias.
    gun.source.abilityId = "other";
  }
}
void forbiddenReaderWrites;
function setup() {
  const world = new World("en"),
    ids = [world.createEntity(), world.createEntity(), world.createEntity()];
  for (const id of ids) {
    world.addComponent(id, COMPONENT.Role, createRoleComponent(Role.Villager, Camp.Good));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent(true));
  }
  return { world, from: ids[0]!, to: ids[1]!, recipient: ids[2]! };
}

test("query/grant outputs retain the original gun while transfer preserves a new owner reference", () => {
  const f = setup(),
    events: import("@ai-werewolf-arena/game-contract").GameEvent[] = [],
    gun = grantDeathGun(f.world, f.from, f.to, 1, events),
    role = f.world.getComponent(f.to, COMPONENT.Role)!;
  expect(allDeathGuns(role)[0]).toBe(gun);
  expect(findDeathGun(role, gun.id)).toBe(gun);
  armDeathGun(f.world, f.to, gun, 2, events);
  expect(activeDeathGun(f.world, f.to, gun.id, 2)).toBe(gun);
  const transferred = transferDeathGun(f.world, f.to, f.recipient, gun.id, events);
  expect(transferred).not.toBe(gun);
  expect(findDeathGun(role, gun.id)).toBeUndefined();
  expect(findDeathGun(f.world.getComponent(f.recipient, COMPONENT.Role), gun.id)).toBe(transferred);
  expect(transferred.source).toEqual({ kind: "transfer", actorId: f.to, abilityId: gun.id });
  expect(deathGunOwnerCurrent(f.world, f.to, gun)).toBe(false);
  expect(deathGunOwnerCurrent(f.world, f.recipient, transferred)).toBe(true);
  expect(Object.isFrozen(transferred)).toBe(false);
});

test("first-death captures keep the same armed resource and final expiry consumes that reference", () => {
  const f = setup(),
    events: import("@ai-werewolf-arena/game-contract").GameEvent[] = [],
    gun = grantDeathGun(f.world, f.from, f.to, 1, events);
  armDeathGun(f.world, f.to, gun, 2, events);
  f.world.getComponent(f.to, COMPONENT.Alive)!.alive = false;
  const rows = firstDeathGuns(f.world, f.to);
  expect(rows[0]!.gun).toBe(gun);
  expect(rows[0]!.armedOnNight).toBe(2);
  finishDeathGuns(rows, events);
  expect(gun.remaining).toBe(0);
  expect(gun.disabled).toBe(true);
  expect(gun.deathExpired).toBe(true);
  expect(firstDeathGuns(f.world, f.to)).toEqual([]);
});

test("the concrete shot command retains a throwing stock setter and does not touch metadata", () => {
  const trace: string[] = [],
    gun: DeathGunReadView = {
      id: "gift-gun:literal",
      kind: "gun",
      source: { kind: "gift", actorId: 1 },
      sourceDisclosed: false,
      grantedNight: 1,
      armedOnNight: 2,
      disabled: false,
      deathExpired: false,
      get remaining() {
        return 1;
      },
      set remaining(_value: 0 | 1) {
        trace.push("remaining");
        throw Error("original_stock_write_failure");
      },
    };
  expect(() => consumeDeathGunShot(gun)).toThrow("original_stock_write_failure");
  expect(trace).toEqual(["remaining"]);
  expect(gun.disabled).toBe(false);
  expect(gun.deathExpired).toBe(false);
});
