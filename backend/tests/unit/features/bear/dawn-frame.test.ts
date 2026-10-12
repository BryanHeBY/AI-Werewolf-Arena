/**
 * Unit tests for bear; Isolated bear dawn-frame contract; native in-memory owner/frame/readers, no assembled game cycle.
 * Inputs are existing in-memory fixtures, original callback controls and explicit
 * invalid mutations. Original literal expectations, identity snapshots and
 * rejection assertions supply the oracle; none are regenerated during relocation.
 * Test-owned mocks/components exercise this boundary without a model or physical
 * transport. Support files, fixture bytes, policy and state behavior are retained.
 */
import { expect, test } from "bun:test";
import { animalRosterFixture } from "../../../engine/animal_dream_fixture";
import { BearNightFrame } from "../../../../src/game/mechanisms/roles/bear/night_frame";
import { getBearState } from "../../../../src/game/mechanisms/roles/private_state";
import { RoleCatalog, getDefaultRoleCatalog } from "../../../../src/game/mechanisms/roles/catalog";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { createAliveComponent } from "../../../../src/core/domain/components/alive";
import { createCampComponent } from "../../../../src/core/domain/components/camp";
import { Camp, Role, type GameEvent } from "../../../../src/core/domain/model";
const frame = (f: ReturnType<typeof animalRosterFixture>, day = 1) =>
  BearNightFrame.capture(f.world, day, undefined, "netease_dawn_live_v1")!;
test("explicit dawn-live resamples the actual living ring while omitted policy keeps the old Night sample", () => {
  const f = animalRosterFixture(),
    old = BearNightFrame.capture(f.world, 1)!,
    next = frame(f),
    events: GameEvent[] = [];
  f.life(12).alive = false;
  old.publish(f.world, events, () => true);
  expect(events.map((e) => e.payload)).toEqual([{ day: 1, roared: false }]);
  getBearState(f.role(11))!.history = [];
  events.length = 0;
  next.publish(f.world, events, () => true);
  expect(events.map((e) => e.payload)).toEqual([{ day: 1, roared: true }]);
  expect(Object.keys(events[0]!.payload)).toEqual(["day", "roared"]);
});
test("pending Cat keeps its actual living seat; actual later death changes the next dawn neighbors", () => {
  const f = animalRosterFixture();
  for (const id of [5, 6, 7, 8]) f.life(id).alive = false;
  const first = frame(f),
    events: GameEvent[] = [];
  f.life(10).alive = false;
  // A pure Cat deferral never changes its original Alive.
  f.role(9).privateState.whiteCat = {
    policy: "awa_animal_dream_v1",
    form: {
      kind: "deferred",
      deferred: {
        day: 1,
        phase: "night",
        firstSources: ["wolf_kill"],
        firstUnit: null,
        expiresAfterUnit: 1,
      },
    },
  };
  first.publish(f.world, events, () => true);
  const second = frame(f, 2);
  f.life(9).alive = false;
  second.publish(f.world, events, () => true);
  expect(events.map((e) => e.payload)).toEqual([
    { day: 1, roared: false },
    { day: 2, roared: true },
  ]);
});
for (const firstDead of [false, true])
  test(`original Bear ${firstDead ? "dead before Night" : "dies during Night"} gives quiet at actual publication`, () => {
    const f = animalRosterFixture();
    if (firstDead) f.life(11).alive = false;
    const next = frame(f),
      events: GameEvent[] = [];
    if (!firstDead) f.life(11).alive = false;
    next.publish(f.world, events, () => true);
    expect(events.map((e) => e.payload)).toEqual([{ day: 1, roared: false }]);
  });
for (const mutate of [
  "bear-replace",
  "bear-revive",
  "neighbor-replace",
  "neighbor-revive",
  "camp-replace",
] as const)
  test(`${mutate} cannot borrow a dawn frame captured from original bodies`, () => {
    const f = animalRosterFixture(),
      next = frame(f),
      events: GameEvent[] = [];
    if (mutate === "bear-replace")
      f.world.addComponent(11, COMPONENT.Alive, createAliveComponent());
    if (mutate === "bear-revive") {
      f.life(11).alive = false;
      f.life(11).alive = true;
    }
    if (mutate === "neighbor-replace")
      f.world.addComponent(12, COMPONENT.Alive, createAliveComponent());
    if (mutate === "neighbor-revive") {
      f.life(12).alive = false;
      f.life(12).alive = true;
    }
    if (mutate === "camp-replace")
      f.world.addComponent(11, COMPONENT.Camp, createCampComponent(Camp.Good));
    next.publish(f.world, events, () => true);
    expect(events).toEqual([]);
    expect(getBearState(f.role(11))!.history).toEqual([]);
  });
test("trusted sensing callback cannot publish a neighbor sample after mutating that neighbor's life", () => {
  const f = animalRosterFixture();
  f.life(12).alive = false;
  const catalog = new RoleCatalog(
      getDefaultRoleCatalog()
        .all()
        .map((p) =>
          p.role === Role.WolfBeauty
            ? {
                ...p,
                detectableByBear: () => {
                  f.life(1).alive = false;
                  return true;
                },
              }
            : p,
        ),
    ),
    next = BearNightFrame.capture(f.world, 1, catalog, "netease_dawn_live_v1")!,
    events: GameEvent[] = [];
  next.publish(f.world, events, () => true);
  expect(events).toEqual([]);
  expect(getBearState(f.role(11))!.history).toEqual([]);
});
test("wrong World does not consume the original frame; real cancellation is terminal", () => {
  const f = animalRosterFixture(),
    foreign = animalRosterFixture(),
    next = frame(f),
    events: GameEvent[] = [];
  next.publish(foreign.world, events, () => true);
  expect(getBearState(f.role(11))!.history).toEqual([]);
  next.publish(f.world, events, () => true);
  next.publish(f.world, events, () => true);
  expect(events.map((e) => e.payload)).toEqual([{ day: 1, roared: false }]);
  const cancelled = frame(f, 2);
  cancelled.publish(f.world, events, () => false);
  cancelled.publish(f.world, events, () => true);
  expect(events).toHaveLength(1);
});
for (const mutation of ["phase", "reentry", "new-live", "freeze-events"] as const)
  test(`${mutation} in the final sensing callback cannot publish a withdrawn or partial report`, () => {
    const f = animalRosterFixture();
    f.life(12).alive = false;
    const events: GameEvent[] = [];
    let current = true,
      called = false;
    let next: BearNightFrame;
    const catalog = new RoleCatalog(
      getDefaultRoleCatalog()
        .all()
        .map((p) =>
          p.role === Role.WolfBeauty
            ? {
                ...p,
                detectableByBear: () => {
                  if (!called) {
                    called = true;
                    if (mutation === "phase") current = false;
                    if (mutation === "reentry") next.publish(f.world, events, () => current);
                    if (mutation === "new-live") f.life(12).alive = true;
                    if (mutation === "freeze-events") Object.freeze(events);
                  }
                  return true;
                },
              }
            : p,
        ),
    );
    next = BearNightFrame.capture(f.world, 1, catalog, "netease_dawn_live_v1")!;
    next.publish(f.world, events, () => current);
    expect(events).toEqual([]);
    expect(getBearState(f.role(11))!.history).toEqual([]);
  });
test("successful dawn is single-use even across new frames after mutable history is cleared", () => {
  const f = animalRosterFixture(),
    events: GameEvent[] = [];
  frame(f).publish(f.world, events, () => true);
  getBearState(f.role(11))!.history = [];
  frame(f).publish(f.world, events, () => true);
  expect(events.map((e) => e.payload)).toEqual([{ day: 1, roared: false }]);
});
