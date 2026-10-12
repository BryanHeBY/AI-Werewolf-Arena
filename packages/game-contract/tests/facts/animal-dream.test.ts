/**
 * Package unit contract for Animal Dream payload and audience data. Literal
 * per-type JSON rows independently preserve hidden/public classification, own
 * beauty history, causal source maps, pair policy limits and accepted legacy
 * scalar conditions. No state owner, vote tally, clock, callback or resolver is
 * loaded; parsing a fact never authorizes an action or commits a game effect.
 */
import { expect, test } from "bun:test";
import {
  ANIMAL_DREAM_EVENT_TYPES,
  animalDreamFactAudience,
  readAnimalDreamFact,
} from "@ai-werewolf-arena/game-contract/facts/animal-dream";
const policy = "awa_animal_dream_v1";
const base = { policy, day: 2 };
const actor = { ...base, actorId: 9 };

test("thirteen literal payload variants retain exact fields and copies", () => {
  const rows: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ["animal_night_opened", base],
    ["animal_fox_chosen", { ...actor, targetId: null }],
    ["animal_fox_effect", { ...actor, targetId: 3, knifeBlocked: true, beautyBlocked: false }],
    ["animal_knife_notified", { ...actor, eligible: true }],
    [
      "animal_beauty_notified",
      {
        ...actor,
        charmAllowed: false,
        linkAllowed: false,
        targetId: null,
        lastActedDay: 2,
        history: [
          { day: 1, targetId: 3 },
          { day: 2, targetId: null },
        ],
      },
    ],
    ["animal_cat_revealed", actor],
    ["animal_puffer_revealed", { ...actor, reason: "knife_death" }],
    ["animal_puffer_decided", { ...actor, activate: false }],
    ["animal_puffer_targets", { ...actor, targetIds: [3, 4], round: 2 }],
    ["animal_wave_prepared", { ...base, phase: "night", proposedIds: [3], blockedCatId: null }],
    [
      "animal_wave_committed",
      { ...base, phase: "voting", deaths: [3], deathSources: { 3: ["exile"] } },
    ],
    ["animal_cat_expiry_prepared", { ...actor, unit: 2, unitKind: "skipped_day" }],
    ["animal_unit_completed", { ...base, unit: 2, kind: "exile" }],
  ];
  expect<unknown>(ANIMAL_DREAM_EVENT_TYPES).toEqual(rows.map(([type]) => type));
  for (const [type, input] of rows) {
    const fact = readAnimalDreamFact(type, input)!;
    expect<unknown>(fact).toEqual({ type, payload: input });
    expect(fact.payload).not.toBe(input);
    expect(readAnimalDreamFact(type, { ...input, extra: true })).toBeNull();
  }
});

test("public reveal stays distinct from actor notice and God settlement facts", () => {
  expect(animalDreamFactAudience("animal_cat_revealed")).toBe("public");
  expect(animalDreamFactAudience("animal_puffer_revealed")).toBe("public");
  for (const type of [
    "animal_fox_chosen",
    "animal_knife_notified",
    "animal_beauty_notified",
    "animal_puffer_decided",
  ] as const)
    expect(animalDreamFactAudience(type)).toBe("actor");
  for (const type of [
    "animal_wave_prepared",
    "animal_wave_committed",
    "animal_fox_effect",
    "animal_puffer_targets",
    "animal_unit_completed",
  ] as const)
    expect(animalDreamFactAudience(type)).toBe("god");
});

test("Fox starts atN2, but the reader does not infer policy implication between boolean flags", () => {
  expect(readAnimalDreamFact("animal_fox_chosen", { ...actor, day: 1, targetId: null })).toBeNull();
  expect(
    readAnimalDreamFact("animal_fox_effect", {
      ...actor,
      targetId: 3,
      knifeBlocked: false,
      beautyBlocked: true,
    }),
  ).not.toBeNull();
  expect(
    readAnimalDreamFact("animal_fox_effect", {
      ...actor,
      targetId: 3,
      knifeBlocked: "false",
      beautyBlocked: true,
    }),
  ).toBeNull();
});

test("Puffer target sets and wave sources keep exact original limits and legacy duplicate causes", () => {
  for (const targetIds of [[], [3, 3], Array.from({ length: 13 }, (_, i) => i + 1)])
    expect(
      readAnimalDreamFact("animal_puffer_targets", { ...actor, targetIds, round: 1 }),
    ).toBeNull();
  expect(
    readAnimalDreamFact("animal_puffer_targets", { ...actor, targetIds: [3], round: 3 }),
  ).toBeNull();
  const wave = { ...base, phase: "voting", deaths: [3], deathSources: { 3: ["exile", "exile"] } };
  expect(readAnimalDreamFact("animal_wave_committed", wave)).not.toBeNull();
  for (const deathSources of [{}, { 3: [] }, { 3: ["poison"] }, { 3: ["exile"], 4: ["charm"] }])
    expect(readAnimalDreamFact("animal_wave_committed", { ...wave, deathSources })).toBeNull();
});

test("Animal retains inclusive safe-integer maximum and large beauty history capacity", () => {
  expect(
    readAnimalDreamFact("animal_cat_revealed", { ...actor, actorId: Number.MAX_SAFE_INTEGER }),
  ).not.toBeNull();
  expect(
    readAnimalDreamFact("animal_cat_revealed", { ...actor, actorId: Number.MAX_SAFE_INTEGER + 1 }),
  ).toBeNull();
  const history = Array.from({ length: 129 }, (_, i) => ({ day: i + 1, targetId: null }));
  const notice = {
    ...actor,
    day: 129,
    charmAllowed: true,
    linkAllowed: true,
    targetId: null,
    lastActedDay: null,
    history,
  };
  expect(readAnimalDreamFact("animal_beauty_notified", notice)).not.toBeNull();
  expect(
    readAnimalDreamFact("animal_beauty_notified", {
      ...notice,
      history: [...history, { day: 129, targetId: null }],
    }),
  ).toBeNull();
});

test("unknown and accessor payloads reject without getter evaluation", () => {
  let reads = 0;
  const input = {
    ...base,
    get actorId() {
      reads++;
      return 9;
    },
  };
  expect(readAnimalDreamFact("legacy_unknown", input)).toBeNull();
  expect(readAnimalDreamFact("animal_cat_revealed", input)).toBeNull();
  expect(reads).toBe(0);
});
