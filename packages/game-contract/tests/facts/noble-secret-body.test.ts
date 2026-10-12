/**
 * Package unit contract for Noble/Secret Body data and knowledge notices.
 * Literal per-event rows are independent oracles for contract dates, nullable
 * choices, source dictionaries, historical knowledge and visibility categories.
 * No original component, request lease, resource owner or death resolver is used.
 * Shared reflection assumes inert inputs; node ingress owns Proxy rejection.
 */
import { expect, test } from "bun:test";
import {
  NOBLE_SECRET_BODY_EVENT_TYPES,
  NOBLE_SECRET_BODY_POLICY,
  nobleSecretBodyVisibility,
  readNobleSecretBodyFact,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
const policy = "awa_noble_secret_body_v1";
const base = { policy, actorId: 2, day: 3 };

test("all thirteen literal families keep exact detached payloads", () => {
  expect(NOBLE_SECRET_BODY_POLICY).toBe(policy);
  const rows: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ["noble_body_knife_committed", { ...base, targetId: null }],
    ["noble_body_native_damage_committed", base],
    ["noble_body_night_opened", { ...base, notifiedActorIds: [2, 3] }],
    ["noble_body_death_committed", { ...base, causes: ["exile"] }],
    [
      "noble_body_sources_committed",
      { ...base, blocked: null, deaths: [3], deathSources: { 3: ["poison"] } },
    ],
    ["noble_servant_chosen", { ...base, targetId: 3, contractId: "servant:night:3" }],
    ["secret_body_chosen", { ...base, targetId: null }],
    [
      "noble_contract_closed",
      {
        ...base,
        targetId: 3,
        contractId: "servant:night:2",
        createdNight: 2,
        expiresNight: 3,
        status: "expired",
        proposedCause: "servant_expiry",
      },
    ],
    ["secret_body_blocked", { ...base, targetId: 3, cause: "poison" }],
    [
      "noble_night_notified",
      {
        ...base,
        wolfActionPolicy: "standard",
        lastNotifiedNight: 3,
        lastChoice: { day: 2, targetId: 3 },
        contracts: [
          {
            id: "servant:night:2",
            targetId: 3,
            createdNight: 2,
            expiresNight: 3,
            status: { kind: "pending" },
          },
        ],
      },
    ],
    [
      "secret_body_night_notified",
      {
        ...base,
        protectionRepeatPolicy: "awa_repeat_v1",
        lastNotifiedNight: 3,
        lastChoice: null,
        resource: "intact",
        publicRevealDay: null,
      },
    ],
    ["secret_body_revealed", base],
    ["secret_body_reveal_speech", { ...base, text: "  Original {player} speech\n中文  " }],
  ];
  expect<unknown>(NOBLE_SECRET_BODY_EVENT_TYPES).toEqual(rows.map(([type]) => type));
  for (const [type, input] of rows) {
    const fact = readNobleSecretBodyFact(type, input);
    expect<unknown>(fact).toEqual(input);
    expect(fact).not.toBe(input);
    expect(Object.getPrototypeOf(fact)).toBeNull();
    expect(readNobleSecretBodyFact(type, { ...input, extra: true })).toBeNull();
  }
});

test("servant pass and closure keep ID/date and cause correlations", () => {
  expect(
    readNobleSecretBodyFact("noble_servant_chosen", { ...base, targetId: null, contractId: null }),
  ).not.toBeNull();
  expect(
    readNobleSecretBodyFact("noble_servant_chosen", {
      ...base,
      day: 1,
      targetId: null,
      contractId: null,
    }),
  ).toBeNull();
  expect(
    readNobleSecretBodyFact("noble_servant_chosen", {
      ...base,
      targetId: 2,
      contractId: "servant:night:3",
    }),
  ).toBeNull();
  const closed = {
    ...base,
    targetId: 3,
    contractId: "servant:night:2",
    createdNight: 2,
    expiresNight: 3,
    status: "expired",
    proposedCause: "servant_expiry",
  };
  for (const delta of [
    { day: 4 },
    { expiresNight: 4 },
    { proposedCause: "poison" },
    { contractId: "invented" },
  ])
    expect(readNobleSecretBodyFact("noble_contract_closed", { ...closed, ...delta })).toBeNull();
  expect(
    readNobleSecretBodyFact("noble_contract_closed", {
      ...base,
      day: 2,
      targetId: 3,
      contractId: "servant:night:2",
      createdNight: 2,
      expiresNight: 3,
      status: "cleared",
    }),
  ).not.toBeNull();
});

test("knowledge notice stays historical and spent/revealed reports do not invent a current choice", () => {
  const known = {
    policy,
    actorId: 2,
    day: 2,
    protectionRepeatPolicy: "awa_nonconsecutive_nights_v1",
    lastNotifiedNight: 2,
    lastChoice: { day: 1, targetId: 3 },
    resource: "spent",
    publicRevealDay: null,
  };
  expect(readNobleSecretBodyFact("secret_body_night_notified", known)).not.toBeNull();
  for (const delta of [
    { lastNotifiedNight: 1 },
    { lastChoice: { day: 2, targetId: 3 } },
    { lastChoice: null },
    { publicRevealDay: 1 },
  ])
    expect(
      readNobleSecretBodyFact("secret_body_night_notified", { ...known, ...delta }),
    ).toBeNull();
  expect(
    readNobleSecretBodyFact("secret_body_night_notified", {
      ...known,
      resource: "exile_revealed",
      publicRevealDay: 1,
    }),
  ).not.toBeNull();
  expect(
    readNobleSecretBodyFact("secret_body_night_notified", {
      ...known,
      resource: "exile_revealed",
      publicRevealDay: 2,
    }),
  ).toBeNull();
});

test("source maps reject missing/orphan causes, duplicates and unsupported death origins", () => {
  const row = { ...base, blocked: null, deaths: [3], deathSources: { 3: ["poison"] } };
  for (const deathSources of [
    {},
    { 3: [] },
    { 3: ["poison", "poison"] },
    { 3: ["exile"] },
    { 3: ["poison"], 4: ["wolf_kill"] },
  ])
    expect(
      readNobleSecretBodyFact("noble_body_sources_committed", { ...row, deathSources }),
    ).toBeNull();
  expect(
    readNobleSecretBodyFact("noble_body_death_committed", {
      ...base,
      causes: ["wolf_kill", "wolf_kill"],
    }),
  ).toBeNull();
});

test("visibility preserves God prefix, public reveal and actor categories", () => {
  expect(nobleSecretBodyVisibility("noble_body_sources_committed")).toBe("god");
  expect(nobleSecretBodyVisibility("noble_body_legacy_unknown")).toBe("god");
  expect(readNobleSecretBodyFact("noble_body_legacy_unknown", base)).toBeNull();
  expect(nobleSecretBodyVisibility("secret_body_revealed")).toBe("public");
  expect(nobleSecretBodyVisibility("secret_body_reveal_speech")).toBe("public");
  expect(nobleSecretBodyVisibility("noble_night_notified")).toBe("actor");
  expect(nobleSecretBodyVisibility("unknown")).toBeNull();
});

test("Noble keeps MAX-minus-one exclusion, array128 and raw speech limits", () => {
  expect(
    readNobleSecretBodyFact("secret_body_chosen", {
      ...base,
      actorId: Number.MAX_SAFE_INTEGER - 1,
      targetId: null,
    }),
  ).toBeNull();
  expect(
    readNobleSecretBodyFact("secret_body_chosen", {
      ...base,
      actorId: Number.MAX_SAFE_INTEGER - 2,
      targetId: null,
    }),
  ).not.toBeNull();
  expect(
    readNobleSecretBodyFact("noble_body_night_opened", {
      ...base,
      notifiedActorIds: Array.from({ length: 129 }, (_, i) => i + 1),
    }),
  ).toBeNull();
  expect(
    readNobleSecretBodyFact("secret_body_reveal_speech", { ...base, text: "x".repeat(8192) }),
  ).not.toBeNull();
  expect(
    readNobleSecretBodyFact("secret_body_reveal_speech", { ...base, text: "x".repeat(8193) }),
  ).toBeNull();
  expect(readNobleSecretBodyFact("secret_body_reveal_speech", { ...base, text: "  " })).toBeNull();
});
