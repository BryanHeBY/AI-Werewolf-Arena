import { expect, test } from "bun:test";
import { COMPONENT, type AliveComponent } from "../../../src/core";
import { redMoonCandidateWorld } from "../../support/red_moon_candidate_world";
import {
  beginDemonHunterNight,
  closeDemonHunterNight,
  freezeDemonHunt,
  commitDemonRedMoonTransition,
  demonRedMoonExpiry,
  demonHunterCheckpointPlayers,
} from "../../../src/game/mechanisms/roles/demon_hunter/authority";
function deferredWorld() {
  const { world } = redMoonCandidateWorld();
  beginDemonHunterNight(world, 1, () => true);
  freezeDemonHunt(world);
  closeDemonHunterNight(world);
  for (const id of [1, 2, 3, 11])
    world.getComponent<AliveComponent>(id, COMPONENT.Alive)!.alive = false;
  expect(commitDemonRedMoonTransition(world, 4, "exile", 1)).toBe(true);
  beginDemonHunterNight(world, 2, () => true);
  return world;
}
test("Delayed Red Moon expires exactly once after the following night sources freeze", () => {
  const world = deferredWorld();
  expect(() => demonRedMoonExpiry(world, 2)).toThrow("red_moon_expiry_phase_invalid");
  expect(commitDemonRedMoonTransition(world, 4, "expire", 2)).toBe(false);
  freezeDemonHunt(world);
  expect(demonRedMoonExpiry(world, 2)).toBe(4);
  expect(commitDemonRedMoonTransition(world, 4, "expire", 2)).toBe(true);
  expect(demonRedMoonExpiry(world, 2)).toBeNull();
  expect(commitDemonRedMoonTransition(world, 4, "expire", 2)).toBe(false);
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
test("Ordinary night damage that already killed delayed Red Moon prevents duplicate expiry", () => {
  const world = deferredWorld();
  freezeDemonHunt(world);
  world.getComponent<AliveComponent>(4, COMPONENT.Alive)!.alive = false;
  expect(demonRedMoonExpiry(world, 2)).toBeNull();
  expect(demonHunterCheckpointPlayers(world, true)).toHaveLength(12);
});
test("Expiry refuses a different day or a closed night", () => {
  const world = deferredWorld();
  freezeDemonHunt(world);
  expect(() => demonRedMoonExpiry(world, 3)).toThrow("red_moon_expiry_phase_invalid");
  closeDemonHunterNight(world);
  expect(() => demonRedMoonExpiry(world, 2)).toThrow("red_moon_expiry_phase_invalid");
});
test("An ordinary frozen night with no deferred exile has no expiry", () => {
  const { world } = redMoonCandidateWorld();
  beginDemonHunterNight(world, 1, () => true);
  freezeDemonHunt(world);
  expect(demonRedMoonExpiry(world, 1)).toBeNull();
});
