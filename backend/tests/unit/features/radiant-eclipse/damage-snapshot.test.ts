/**
 * Unit tests for radiant-eclipse; Isolated radiant-eclipse damage-snapshot contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { World } from "../../../../src/core/domain/world";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createAliveComponent, aliveLifeVersion } from "../../../../src/core/domain/components/alive";
import { captureNightLife, type NightImmunityClaim } from "../../../../src/core/domain/night_effects";
import {
  DreamNightFrame,
  type DreamNightLink,
} from "../../../../src/game/mechanisms/roles/dreamer/night_frame";
function fixture() {
  const world = new World();
  for (let n = 0; n < 5; n++)
    world.addComponent(world.createEntity(), COMPONENT.Alive, createAliveComponent());
  const body = (n: number) =>
    world.getComponent<ReturnType<typeof createAliveComponent>>(n, COMPONENT.Alive)!;
  const scope = (n: number) => captureNightLife(world, n)!;
  const link: DreamNightLink = {
    actorId: 2,
    targetId: 4,
    day: 2,
    consecutive: true,
    actorLife: body(2),
    targetLife: body(4),
    actorVersion: aliveLifeVersion(body(2)),
    targetVersion: aliveLifeVersion(body(4)),
  };
  return { world, body, scope, link };
}
test("adding to the caller's readonly-compatible array cannot authorize a new shelter in a captured frame", () => {
  const f = fixture(),
    claims: NightImmunityClaim[] = [],
    frame = new DreamNightFrame([f.link], claims);
  claims.push({ target: f.scope(4), isCurrent: () => true });
  expect(frame.consecutiveDeaths(f.world)).toEqual([4]);
});
test("clearing the caller's array cannot remove a shelter already captured by a frame", () => {
  const f = fixture(),
    claims: NightImmunityClaim[] = [{ target: f.scope(4), isCurrent: () => true }],
    frame = new DreamNightFrame([f.link], claims);
  claims.length = 0;
  expect(frame.consecutiveDeaths(f.world)).toEqual([]);
});
test("a mutable source claim cannot move captured shelter to another original body", () => {
  const f = fixture(),
    claim = { target: f.scope(4), isCurrent: () => true },
    frame = new DreamNightFrame([f.link], [claim]);
  claim.target = f.scope(5);
  expect(frame.consecutiveDeaths(f.world)).toEqual([]);
});
test("valid claim method keeps its receiver in the Dream filter as it does in damage resolution", () => {
  const f = fixture();
  const claim: NightImmunityClaim = {
    target: f.scope(4),
    isCurrent() {
      return this.target.id === 4;
    },
  };
  const frame = new DreamNightFrame([f.link], [claim]);
  expect(frame.consecutiveDeaths(f.world)).toEqual([]);
});
test("captured authorization callback stays live, not an eagerly cached boolean", () => {
  const f = fixture();
  let current = true;
  const frame = new DreamNightFrame([f.link], [{ target: f.scope(4), isCurrent: () => current }]);
  current = false;
  expect(frame.consecutiveDeaths(f.world)).toEqual([4]);
});
test("shelter follows eligible original first death, but never same-body revival", () => {
  const f = fixture(),
    frame = new DreamNightFrame([f.link], [{ target: f.scope(4), isCurrent: () => true }]);
  f.body(4).alive = false;
  expect(frame.linkedDeaths(f.world, [2], new Set([4]))).toEqual([]);
  f.body(4).alive = true;
  expect(frame.linkedDeaths(f.world, [2], new Set([4]))).toEqual([]);
});
