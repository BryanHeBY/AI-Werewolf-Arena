/**
 * Package unit contract for Wild Child full source and player transformation data.
 * Literal commit IDs, source lists and own shapes independently verify privacy
 * and original date correlations. No player transforms, pack rights or death
 * callbacks are executed; shared reader assumptions do not replace Node guards.
 */
import { expect, test } from "bun:test";
import {
  WILD_CHILD_EVENT_TYPES,
  readWildChildEventFact,
  readWildChildPlayerFact,
} from "@ai-werewolf-arena/game-contract/facts/wild-child";
test("full transformation and own notification keep separate exact fields", () => {
  expect(WILD_CHILD_EVENT_TYPES).toHaveLength(4);
  const full = {
      actorId: 1,
      day: 2,
      eligibleNight: 3,
      camp: "wolf",
      deathCommit: "wild-model:1:2:2",
    },
    own = { actorId: 1, day: 2, eligibleNight: 3, camp: "wolf" };
  expect<unknown>(readWildChildEventFact("wild_child_transformed", full)).toEqual(full);
  expect<unknown>(readWildChildPlayerFact("wild_child_transformed", own)).toEqual(own);
  expect(readWildChildPlayerFact("wild_child_transformed", full)).toBeNull();
  expect(readWildChildEventFact("wild_child_transformed", own)).toBeNull();
});
test("model death source records remain hidden from player facts", () => {
  const row = {
    actorId: 1,
    targetId: 2,
    day: 2,
    phase: "night",
    deathCommit: "wild-model:1:2:2",
    sources: ["wolf_kill"],
    deadIds: [2, 3],
  };
  expect<unknown>(readWildChildEventFact("wild_child_model_eliminated", row)).toEqual(row);
  expect(readWildChildPlayerFact("wild_child_model_eliminated", row)).toBeNull();
  for (const delta of [
    { deathCommit: "wild-model:1:2:1" },
    { deadIds: [3] },
    { deadIds: [2, 2] },
    { sources: ["wolf_kill", "wolf_kill"] },
  ])
    expect(readWildChildEventFact("wild_child_model_eliminated", { ...row, ...delta })).toBeNull();
});
test("first-night choice and activation bounds preserve inclusive IDs and null rejection", () => {
  expect(
    readWildChildEventFact("wild_child_model_chosen", {
      actorId: Number.MAX_SAFE_INTEGER,
      day: 1,
      targetId: 2,
    }),
  ).not.toBeNull();
  expect(
    readWildChildEventFact("wild_child_model_chosen", { actorId: 1, day: 2, targetId: 2 }),
  ).toBeNull();
  expect(
    readWildChildEventFact("wild_child_pack_activated", { actorId: 1, day: 2, eligibleNight: 3 }),
  ).toBeNull();
  expect(readWildChildEventFact("unknown", { actorId: 1, day: 1 })).toBeNull();
});
