import { expect, test } from "bun:test";
import { animalRosterFixture } from "../animal_dream_fixture";
import {
  appendAnimalFact,
  animalFoxKnowledge,
  animalBeautyKnowledge,
} from "../../../src/game/mechanisms/roles/animal_dream/facts";
import type { GameEvent } from "../../../src/core";
const foxPayload = { policy: "awa_animal_dream_v1", day: 2, actorId: 10, targetId: 1 } as const;
for (const kind of ["frozen", "sealed", "nonextensible", "fixed-length", "plain-object"] as const)
  test(`cannot publish to ${kind}: known resource is unchanged`, () => {
    const { world } = animalRosterFixture();
    const log: unknown =
      kind === "frozen"
        ? Object.freeze([])
        : kind === "sealed"
          ? Object.seal([])
          : kind === "nonextensible"
            ? Object.preventExtensions([])
            : kind === "fixed-length"
              ? Object.defineProperty([], "length", { writable: false })
              : { length: 0 };
    expect(() =>
      appendAnimalFact(world, log as GameEvent[], "animal_fox_chosen", foxPayload),
    ).toThrow("animal_fact_log_invalid");
    expect(animalFoxKnowledge(world, 10)).toEqual({ remaining: 1, lastChoice: null });
    expect((log as { length: number }).length).toBe(0);
  });
test("Proxy array rejection executes zero traps and leaves knowledge unchanged", () => {
  const { world } = animalRosterFixture();
  let traps = 0;
  const log = new Proxy([], {
    get() {
      traps++;
      throw Error("getter");
    },
    getPrototypeOf() {
      traps++;
      throw Error("proto");
    },
    defineProperty() {
      traps++;
      throw Error("define");
    },
    isExtensible() {
      traps++;
      throw Error("extensible");
    },
  });
  expect(() => appendAnimalFact(world, log, "animal_fox_chosen", foxPayload)).toThrow(
    "animal_fact_log_invalid",
  );
  expect(traps).toBe(0);
  expect(animalFoxKnowledge(world, 10)).toEqual({ remaining: 1, lastChoice: null });
});
test("native publish never executes overridden push and stores immutable detached fact", () => {
  const { world } = animalRosterFixture(),
    events: GameEvent[] = [];
  let called = 0;
  Object.defineProperty(events, "push", {
    get() {
      called++;
      throw Error("push accessor");
    },
  });
  const payload = { ...foxPayload };
  appendAnimalFact(world, events, "animal_fox_chosen", payload);
  expect(called).toBe(0);
  expect(events).toHaveLength(1);
  expect(Object.isFrozen(events[0]!)).toBe(true);
  expect(Object.isFrozen(events[0]!.payload)).toBe(true);
  expect(Reflect.set(events[0]!.payload, "targetId", 5)).toBe(false);
  payload.targetId = 5 as 1;
  expect(events[0]!.payload).toEqual(foxPayload);
  expect(animalFoxKnowledge(world, 10)).toEqual({
    remaining: 0,
    lastChoice: { day: 2, targetId: 1 },
  });
});
test("nested Beauty history and returned knowledge cannot modify published or cached facts", () => {
  const { world } = animalRosterFixture(),
    events: GameEvent[] = [];
  const payload = {
    policy: "awa_animal_dream_v1" as const,
    day: 2,
    actorId: 1,
    charmAllowed: false,
    linkAllowed: false,
    targetId: null,
    lastActedDay: 1,
    history: [{ day: 1, targetId: 5 }],
  };
  appendAnimalFact(world, events, "animal_beauty_notified", payload);
  const published = events[0]!.payload as typeof payload;
  expect(Object.isFrozen(published.history)).toBe(true);
  expect(Object.isFrozen(published.history[0]!)).toBe(true);
  expect(Reflect.set(published.history[0]!, "targetId", 8)).toBe(false);
  payload.history[0]!.targetId = 7;
  payload.charmAllowed = true;
  const view = animalBeautyKnowledge(world, 1);
  view.history[0]!.targetId = 6;
  view.linkAllowed = true;
  const expected = {
    charmAllowed: false,
    linkAllowed: false,
    targetId: null,
    lastActedDay: 1,
    history: [{ day: 1, targetId: 5 }],
  };
  expect(animalBeautyKnowledge(world, 1)).toEqual(expected);
  expect(published).toEqual({ policy: "awa_animal_dream_v1", day: 2, actorId: 1, ...expected });
});
