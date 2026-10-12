import { expect, test } from "bun:test";
import {
  FRAGRANT_PAIR_POLICY,
  readPairCheckFact,
  readFragrantKnownState,
  readFragrantPairFact,
  type FragrantKnowledge,
  type FragrantPairPayloadMap,
} from "@ai-werewolf-arena/game-text";
import { readFragrantKnowledge } from "../../../src/game/mechanisms/roles/fragrant_pair_seer/knowledge";
const known: FragrantKnowledge = {
  knownWolfId: 3,
  lastOpenedNight: 1,
  lastChoice: null,
  activeBinding: null,
  used: false,
  knifeNotices: [{ day: 1, eligible: false }],
};
const base = { policy: FRAGRANT_PAIR_POLICY, actorId: 1, day: 1 };
test("pair wire fact contains only normalized pair, day and aggregate boolean", () => {
  for (const containsWerewolf of [true, false])
    expect(readPairCheckFact({ day: 1, targetIds: [5, 6], containsWerewolf })).toEqual({
      day: 1,
      targetIds: [5, 6],
      containsWerewolf,
    });
  for (const targetIds of [[5], [5, 5], [6, 5], [5, 6, 7]])
    expect(readPairCheckFact({ day: 1, targetIds, containsWerewolf: false })).toBeNull();
  for (const extra of [
    { count: 1 },
    { targetCamp: "wolf" },
    { role: "wolf" },
    { results: [true, false] },
  ])
    expect(
      readPairCheckFact({ day: 1, targetIds: [5, 6], containsWerewolf: true, ...extra }),
    ).toBeNull();
});
test("shared knowledge schema matches the Node boundary without aliasing or God fields", () => {
  const shared = readFragrantKnownState(known),
    domain = readFragrantKnowledge(known);
  expect(shared).toEqual(domain);
  expect(shared).toEqual(known);
  expect(shared).not.toBe(known);
  expect(shared!.knifeNotices).not.toBe(known.knifeNotices);
  expect(readFragrantKnownState({ ...known, rootId: 9 })).toBeNull();
  expect(readFragrantKnownState({ ...known, wolfIds: [2, 3, 4] })).toBeNull();
  expect(readFragrantKnownState({ ...known, remainingWolves: 3 })).toBeNull();
  expect(
    readFragrantKnownState({ ...known, knownWolfId: null, lastChoice: { day: 1, pairIds: null } }),
  ).toBeNull();
});
test("night notice permits one known wolf and truthful frozen knife history, never initial knife", () => {
  expect(readFragrantPairFact("fragrant_night_notified", { ...base, known })).toEqual({
    ...base,
    known,
  });
  for (const invalid of [
    { ...known, knownWolfId: 1 },
    { ...known, knownWolfId: null },
    { ...known, knifeNotices: [{ day: 1, eligible: true }] },
    { ...known, knifeNotices: [] },
    { ...known, lastChoice: { day: 1, pairIds: null } },
    { ...known, lastOpenedNight: 2 },
  ])
    expect(readFragrantPairFact("fragrant_night_notified", { ...base, known: invalid })).toBeNull();
  const next: FragrantKnowledge = {
    ...known,
    lastOpenedNight: 2,
    lastChoice: { day: 1, pairIds: [9, 10] },
    used: true,
    knifeNotices: [...known.knifeNotices, { day: 2, eligible: true }],
  };
  expect(
    readFragrantPairFact("fragrant_night_notified", { ...base, day: 2, known: next }),
  ).not.toBeNull();
  expect(
    readFragrantKnownState({
      ...next,
      lastOpenedNight: 3,
      knifeNotices: [...next.knifeNotices, { day: 3, eligible: false }],
    }),
  ).toBeNull();
  const falseHistory = {
    ...next,
    knifeNotices: [
      { day: 1, eligible: true },
      { day: 2, eligible: true },
    ],
  };
  expect(readFragrantKnownState(falseHistory)).toBeNull();
  expect(readFragrantKnowledge(falseHistory)).toBeNull();
  expect(
    readFragrantPairFact("fragrant_night_notified", { ...base, day: 2, known: falseHistory }),
  ).toBeNull();
  expect(
    readFragrantPairFact("fragrant_night_notified", {
      ...base,
      day: 2,
      known: { ...next, knifeNotices: [{ day: 2, eligible: true }] },
    }),
  ).toBeNull();
});
test("binding expiry and actual wave schemas keep same-wave no-addition explicit", () => {
  expect(
    readFragrantPairFact("fragrant_binding_expired", {
      ...base,
      day: 2,
      bindingId: "fragrant:night:1",
      createdNight: 1,
      pairIds: [9, 10],
    }),
  ).not.toBeNull();
  expect(
    readFragrantPairFact("fragrant_binding_expired", {
      ...base,
      bindingId: "fragrant:night:1",
      createdNight: 1,
      pairIds: [9, 10],
    }),
  ).toBeNull();
  const trigger: FragrantPairPayloadMap["fragrant_link_triggered"] = {
    ...base,
    bindingId: "fragrant:night:1",
    pairIds: [9, 10],
    rootId: 9,
    addedTargetId: null,
    rootPhase: "night",
    initialWave: true,
  };
  expect(readFragrantPairFact("fragrant_link_triggered", trigger)).toEqual(trigger);
  expect(
    readFragrantPairFact("fragrant_link_triggered", { ...trigger, addedTargetId: 10 }),
  ).not.toBeNull();
  for (const invalid of [
    { rootId: 8 },
    { addedTargetId: 9 },
    { addedTargetId: 11 },
    { bindingId: "fragrant:night:2" },
    { rootPhase: "game_over" },
    { initialWave: 1 },
  ])
    expect(readFragrantPairFact("fragrant_link_triggered", { ...trigger, ...invalid })).toBeNull();
});
test("pair choice allows explicit pass, rejects missing or malformed second target", () => {
  expect(readFragrantPairFact("fragrant_pair_chosen", { ...base, pairIds: null })).not.toBeNull();
  expect(readFragrantPairFact("fragrant_pair_chosen", { ...base, pairIds: [1, 9] })).not.toBeNull();
  expect(readFragrantPairFact("fragrant_pair_chosen", base)).toBeNull();
  expect(readFragrantPairFact("fragrant_pair_chosen", { ...base, pairIds: [9] })).toBeNull();
  expect(
    readFragrantPairFact("fragrant_pair_inspected", {
      ...base,
      actorId: 5,
      targetIds: [5, 6],
      containsWerewolf: false,
    }),
  ).not.toBeNull();
  expect(
    readFragrantPairFact("fragrant_pair_inspected", {
      ...base,
      actorId: 5,
      targetIds: [5, 6],
      containsWerewolf: false,
      result: "good",
    }),
  ).toBeNull();
});
test("wire snapshots never invoke getters and Node boundary additionally rejects proxies", () => {
  let reads = 0;
  expect(
    readFragrantKnownState({
      ...known,
      get knownWolfId() {
        reads++;
        return 3;
      },
    }),
  ).toBeNull();
  expect(
    readFragrantKnowledge(
      new Proxy(known, {
        getOwnPropertyDescriptor: () => {
          reads++;
          throw Error("proxy");
        },
      }),
    ),
  ).toBeNull();
  expect(reads).toBe(0);
  expect(readFragrantPairFact("unknown", { ...base, pairIds: null })).toBeNull();
});
