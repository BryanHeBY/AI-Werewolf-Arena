/**
 * Package unit contract for Fragrant pair, causal wave and known-state readers.
 * Literal events independently check pair ordering, historical notices, source
 * and phase maps, nulls and the original large array bound. No RNG, lease,
 * original life object or domain relation resolver participates in the oracle.
 */
import { expect, test } from "bun:test";
import {
  FRAGRANT_PAIR_EVENT_TYPES,
  FRAGRANT_PAIR_POLICY,
  fragrantPairVisibility,
  readFragrantKnownState,
  readFragrantPairFact,
  readPairCheckFact,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
const policy = "awa_fragrant_pair_seer_v1";
const base = { policy, actorId: 1, day: 2 };
const known = () => ({
  knownWolfId: 2,
  lastOpenedNight: 2,
  lastChoice: null,
  activeBinding: null,
  used: false,
  knifeNotices: [
    { day: 1, eligible: false },
    { day: 2, eligible: true },
  ],
});

test("all seven families preserve detached payload maps and event order", () => {
  expect(FRAGRANT_PAIR_POLICY).toBe(policy);
  const rows: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    [
      "fragrant_wave_committed",
      {
        ...base,
        deaths: [3],
        deathSources: { 3: ["wolf_kill"] },
        deathPhases: { 3: "night" },
        initialWave: true,
      },
    ],
    ["fragrant_night_opened", { ...base, knowledgeDrawCount: 0 }],
    ["fragrant_pair_chosen", { ...base, pairIds: [3, 4] }],
    ["fragrant_pair_inspected", { ...base, targetIds: [3, 4], containsWerewolf: false }],
    ["fragrant_night_notified", { ...base, known: known() }],
    [
      "fragrant_binding_expired",
      { ...base, day: 3, bindingId: "fragrant:night:2", createdNight: 2, pairIds: [3, 4] },
    ],
    [
      "fragrant_link_triggered",
      {
        ...base,
        bindingId: "fragrant:night:2",
        pairIds: [3, 4],
        rootId: 3,
        addedTargetId: 4,
        rootPhase: "voting",
        initialWave: false,
      },
    ],
  ];
  expect<unknown>(FRAGRANT_PAIR_EVENT_TYPES).toEqual(rows.map(([type]) => type));
  for (const [type, input] of rows) {
    const fact = readFragrantPairFact(type, input);
    expect<unknown>(fact).toEqual(input);
    expect(fact).not.toBe(input);
    expect(readFragrantPairFact(type, { ...input, extra: true })).toBeNull();
  }
});

test("pair checks and choices preserve readonly sorted pair, pass and MAX-minus-one boundary", () => {
  expect(readPairCheckFact({ day: 1, targetIds: [3, 4], containsWerewolf: true })).toEqual({
    day: 1,
    targetIds: [3, 4],
    containsWerewolf: true,
  });
  for (const targetIds of [[4, 3], [3, 3], [3], [3, Number.MAX_SAFE_INTEGER - 1]])
    expect(readPairCheckFact({ day: 1, targetIds, containsWerewolf: true })).toBeNull();
  expect(readFragrantPairFact("fragrant_pair_chosen", { ...base, pairIds: null })).not.toBeNull();
  expect(
    readFragrantPairFact("fragrant_pair_chosen", {
      ...base,
      actorId: Number.MAX_SAFE_INTEGER - 1,
      pairIds: null,
    }),
  ).toBeNull();
  expect(
    readFragrantPairFact("fragrant_pair_chosen", {
      ...base,
      actorId: Number.MAX_SAFE_INTEGER - 2,
      pairIds: null,
    }),
  ).not.toBeNull();
});

test("known state preserves pre-notification structural gaps but full notice requires contiguous history", () => {
  expect(
    readFragrantKnownState({
      knownWolfId: null,
      lastOpenedNight: 0,
      lastChoice: null,
      activeBinding: null,
      used: false,
      knifeNotices: [],
    }),
  ).not.toBeNull();
  const gap = { ...known(), knifeNotices: [{ day: 2, eligible: false }] };
  expect(readFragrantKnownState(gap)).not.toBeNull();
  expect(readFragrantPairFact("fragrant_night_notified", { ...base, known: gap })).toBeNull();
  expect(
    readFragrantKnownState({ ...known(), knifeNotices: [{ day: 1, eligible: true }] }),
  ).toBeNull();
  expect(
    readFragrantKnownState({
      ...known(),
      lastOpenedNight: 3,
      knifeNotices: [
        { day: 1, eligible: false },
        { day: 2, eligible: true },
        { day: 3, eligible: false },
      ],
    }),
  ).toBeNull();
});

test("active binding and spent history remain data correlations without creating a relation", () => {
  const active = {
    ...known(),
    lastChoice: { day: 2, pairIds: [3, 4] },
    activeBinding: { createdNight: 2, expiresNight: 3, pairIds: [3, 4] },
  };
  expect(readFragrantKnownState(active)).not.toBeNull();
  expect(readFragrantKnownState({ ...active, used: true })).toBeNull();
  expect(
    readFragrantKnownState({
      ...active,
      activeBinding: { ...active.activeBinding, expiresNight: 4 },
    }),
  ).toBeNull();
  expect(readFragrantPairFact("fragrant_night_notified", { ...base, known: active })).toBeNull();
});

test("wave/link maps reject orphan phases, unsupported causes and unrelated roots", () => {
  const wave = {
    ...base,
    deaths: [3],
    deathSources: { 3: ["wolf_kill"] },
    deathPhases: { 3: "night" },
    initialWave: true,
  };
  for (const delta of [
    { deathPhases: {} },
    { deathPhases: { 3: "night", 4: "day" } },
    { deathSources: { 3: ["charm"] } },
    { initialWave: "false" },
  ])
    expect(readFragrantPairFact("fragrant_wave_committed", { ...wave, ...delta })).toBeNull();
  const link = {
    ...base,
    bindingId: "fragrant:night:2",
    pairIds: [3, 4],
    rootId: 3,
    addedTargetId: null,
    rootPhase: "night",
    initialWave: true,
  };
  expect(readFragrantPairFact("fragrant_link_triggered", link)).not.toBeNull();
  for (const delta of [
    { rootId: 5 },
    { addedTargetId: 3 },
    { bindingId: "fragrant:night:1" },
    { rootPhase: "game_over" },
  ])
    expect(readFragrantPairFact("fragrant_link_triggered", { ...link, ...delta })).toBeNull();
});

test("large notice arrays retain explicit65536 capacity and audience does not authorize actions", () => {
  const long = {
    knownWolfId: 2,
    lastOpenedNight: 129,
    lastChoice: null,
    activeBinding: null,
    used: false,
    knifeNotices: Array.from({ length: 129 }, (_, i) => ({ day: i + 1, eligible: false })),
  };
  expect(readFragrantKnownState(long)).not.toBeNull();
  expect(
    readFragrantPairFact("fragrant_night_notified", { ...base, day: 129, known: long }),
  ).not.toBeNull();
  expect(fragrantPairVisibility("fragrant_wave_committed")).toBe("god");
  expect(fragrantPairVisibility("fragrant_night_notified")).toBe("actor");
  expect(fragrantPairVisibility("legacy_unknown")).toBeNull();
});
