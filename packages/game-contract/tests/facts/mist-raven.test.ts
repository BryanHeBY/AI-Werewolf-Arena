/**
 * Package unit contract for Mist/Raven structural facts. Literal triples, draw
 * candidates and notifications are the independent oracle for uniqueness, null,
 * self-target exceptions and exact reason fields. No RNG, team lookup or domain
 * permission is evaluated; node ingress owns hostile-object safety separately.
 */
import { expect, test } from "bun:test";
import {
  MIST_RAVEN_EVENT_TYPES,
  readMistRavenFact,
} from "@ai-werewolf-arena/game-contract/facts/mist-raven";

test("event sequence and unsorted unique mist triple stay descriptive", () => {
  expect(MIST_RAVEN_EVENT_TYPES).toEqual([
    "alchemist_mist_chosen",
    "alchemist_mist_skipped",
    "alchemist_snake_chosen",
    "raven_unsealed",
    "raven_knife_chosen",
    "raven_knife_skipped",
    "mist_knife_drawn",
  ]);
  const row = { actorId: 2, day: 1, targetIds: [4, 2, 3] };
  const fact = readMistRavenFact("alchemist_mist_chosen", row)!;
  expect(fact).toEqual(row);
  expect(fact).not.toBe(row);
  expect(
    readMistRavenFact("alchemist_mist_chosen", { actorId: 2, day: 1, targetIds: null }),
  ).not.toBeNull();
  for (const targetIds of [
    [2, 3],
    [2, 2, 3],
    [1, 2, 3, 4],
  ])
    expect(
      readMistRavenFact("alchemist_mist_chosen", { actorId: 2, day: 1, targetIds }),
    ).toBeNull();
});
test("snake self-target is first-night only while raven knife forbids itself", () => {
  expect(
    readMistRavenFact("alchemist_snake_chosen", { actorId: 2, day: 1, targetId: 2 }),
  ).not.toBeNull();
  expect(
    readMistRavenFact("alchemist_snake_chosen", { actorId: 2, day: 2, targetId: 2 }),
  ).toBeNull();
  expect(readMistRavenFact("raven_knife_chosen", { actorId: 2, day: 1, targetId: 2 })).toBeNull();
  for (const type of ["alchemist_snake_chosen", "raven_knife_chosen"])
    expect(readMistRavenFact(type, { actorId: 2, day: 2, targetId: null })).not.toBeNull();
});
test("knife draw requires the selected member or an empty null outcome", () => {
  expect(readMistRavenFact("mist_knife_drawn", { day: 1, candidates: [], targetId: null })).toEqual(
    { day: 1, candidates: [], targetId: null },
  );
  expect(
    readMistRavenFact("mist_knife_drawn", { day: 1, candidates: [4, 3, 2], targetId: 3 }),
  ).not.toBeNull();
  for (const row of [
    { day: 1, candidates: [2, 3], targetId: null },
    { day: 1, candidates: [2, 3], targetId: 4 },
    { day: 1, candidates: [2, 2], targetId: 2 },
    { day: 1, candidates: [1, 2, 3, 4], targetId: 2 },
  ])
    expect(readMistRavenFact("mist_knife_drawn", row)).toBeNull();
});
test("unseal and reason variants keep exact own-notification shapes", () => {
  expect(
    readMistRavenFact("raven_unsealed", {
      actorId: 2,
      day: 1,
      awakened: true,
      knownTeammateIds: [3],
    }),
  ).not.toBeNull();
  for (const knownTeammateIds of [[2], [3, 4]])
    expect(
      readMistRavenFact("raven_unsealed", { actorId: 2, day: 1, awakened: true, knownTeammateIds }),
    ).toBeNull();
  expect(
    readMistRavenFact("raven_knife_skipped", { actorId: 2, day: 1, reason: "sealed" }),
  ).not.toBeNull();
  expect(
    readMistRavenFact("alchemist_mist_skipped", { actorId: 2, day: 1, reason: "sealed" }),
  ).toBeNull();
  for (const reason of ["dead", "spent", "no_targets"])
    expect(
      readMistRavenFact("alchemist_mist_skipped", { actorId: 2, day: 1, reason }),
    ).not.toBeNull();
});
test("unknown, extra, upper-bound and accessor payloads reject without reading getters", () => {
  expect(
    readMistRavenFact("alchemist_snake_chosen", {
      actorId: Number.MAX_SAFE_INTEGER,
      day: 1,
      targetId: null,
    }),
  ).toBeNull();
  expect(
    readMistRavenFact("alchemist_snake_chosen", {
      actorId: Number.MAX_SAFE_INTEGER - 1,
      day: 1,
      targetId: null,
    }),
  ).not.toBeNull();
  expect(
    readMistRavenFact("raven_unsealed", {
      actorId: 2,
      day: 1,
      awakened: true,
      knownTeammateIds: [],
      extra: true,
    }),
  ).toBeNull();
  let reads = 0;
  const row = {
    actorId: 2,
    day: 1,
    get targetId() {
      reads++;
      return 3;
    },
  };
  expect(readMistRavenFact("unknown", row)).toBeNull();
  expect(readMistRavenFact("alchemist_snake_chosen", row)).toBeNull();
  expect(reads).toBe(0);
});
