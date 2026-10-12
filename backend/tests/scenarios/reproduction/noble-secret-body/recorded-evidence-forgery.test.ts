/**
 * Reproduction scenarios verify actual Noble and Secret Body recordings retain paid source evidence, knowledge and terminal contracts.
 * Input: Original beforeAll complete/failed games, uniquely named literal plan additions and copied multi-field evidence forgeries.
 * Output and oracle: Explicit mark, stock, audience, receipt/checkpoint and exact-replay assertions remain causal; original shared plan mutations and callback order are preserved rather than duplicated.
 */
import { beforeAll, expect, test } from "bun:test";
import { nobleLiteralPlans, recordNobleLiteral } from "../../../support/noble_secret_body_recording";
import { Camp, PotionType } from "../../../../src/core";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";

let complete: ReproductionRecord;
let earlyFailed: ReproductionRecord;
beforeAll(async () => {
  complete = (await recordNobleLiteral("expiry")).record;
  nobleLiteralPlans.early_poison_failure = [
    {
      body: 7,
      servant: null,
      knife: 6,
      hunt: null,
      exile: 10,
      potion: { target: 6, type: PotionType.Poison },
    },
  ];
  earlyFailed = (
    await recordNobleLiteral("early_poison_failure", "en", { failureStage: "seer", failureDay: 1 })
  ).record;
});

test("body Night request cannot be relabeled Day with unchanged tool and action", () => {
  const r = structuredClone(complete);
  r.decisions[0]!.request.phase = "day" as any;
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_noble_secret_body_invalid");
});

test("public speech cannot authorize private inventory metadata through co-tampered feeds", () => {
  const r = structuredClone(complete),
    e = r.events.find((e) => e.type === "day_speech")!,
    original = JSON.stringify(e.payload);
  e.payload.noble_actual_inventory = { bodySpent: true, servantTarget: 6 };
  for (const d of r.decisions)
    for (const f of d.request.context.visible_events)
      if (f.type === "day_speech" && JSON.stringify(f.payload) === original)
        f.payload = structuredClone(e.payload);
  expect(() => parseReproductionRecord(r)).toThrow();
});

test("God source commit cannot acquire actor audience", () => {
  const r = structuredClone(complete);
  r.events.find((e) => e.type === "noble_body_sources_committed")!.audience = [5];
  expect(() => parseReproductionRecord(r)).toThrow();
});

for (const type of ["noble_body_sources_committed", "noble_contract_closed"])
  test(`independent domain evidence rejects duplicate ${type}`, () => {
    const r = structuredClone(complete),
      i = r.events.findIndex((e) => e.type === type);
    r.events.splice(i + 1, 0, structuredClone(r.events[i]!));
    for (const cp of r.checkpoints) if (cp.eventCount > i) cp.eventCount++;
    for (const d of r.decisions) if (d.openedAtEventCount! > i) d.openedAtEventCount!++;
    for (const op of r.operations) if (op.event_count! > i) op.event_count!++;
    expect(() => parseReproductionRecord(r)).toThrow("reproduction_noble_secret_body_invalid");
  });

test("failed required Seer cannot be followed by a forged native clear commit", () => {
  const r = structuredClone(earlyFailed),
    payload = { policy: "awa_noble_secret_body_v1", actorId: 5, day: 1 };
  r.events.push({
    type: "noble_body_native_damage_committed",
    timestamp: r.events.at(-1)!.timestamp,
    payload,
    audience: [],
  });
  r.operations.push({
    scope: "resolution",
    op: "noble_body_native_damage_committed",
    phase: "night" as any,
    status: "ok",
    output: payload,
    event_count: r.events.length,
  });
  const cp = r.checkpoints.at(-1)!;
  cp.eventCount++;
  cp.operationCount!++;
  cp.players.find((p) => p.id === 6)!.marks = [];
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_noble_secret_body_invalid");
});

test("co-delete native clearing evidence and retain marks cannot forge a completed night", () => {
  const r = structuredClone(complete),
    ei = r.events.findIndex((e) => e.type === "noble_body_native_damage_committed"),
    oi = r.operations.findIndex((o) => o.op === "noble_body_native_damage_committed");
  r.events.splice(ei, 1);
  r.operations.splice(oi, 1);
  for (const cp of r.checkpoints) {
    if (cp.eventCount > ei) cp.eventCount--;
    if (cp.operationCount! > oi) cp.operationCount!--;
  }
  for (const d of r.decisions) if (d.openedAtEventCount! > ei) d.openedAtEventCount!--;
  for (const op of r.operations) if (op.event_count! > ei) op.event_count!--;
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_noble_secret_body_invalid");
});

test("own future body choice cannot enter the prompt that selected it", () => {
  const r = structuredClone(complete),
    i = r.events.findIndex((e) => e.type === "secret_body_chosen"),
    e = r.events[i]!;
  const d = r.decisions[0]!;
  d.openedAtEventCount = i + 1;
  d.request.context.visible_events.push({
    seq: 3,
    type: e.type,
    payload: structuredClone(e.payload),
  });
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_noble_secret_body_invalid");
});

test("jointly forged audience and feeds cannot authorize a villager wolf tactical order", () => {
  const r = structuredClone(complete),
    i = r.events.findIndex((e) => e.type === "wolf_tactical_order"),
    e = r.events[i]!;
  e.audience = [1, 6, 10, 11, 12];
  for (const d of r.decisions)
    if (d.actorId === 6 && d.openedAtEventCount! > i) {
      const f = d.request.context.visible_events;
      f.splice(1, 0, { seq: 0, type: e.type, payload: structuredClone(e.payload) });
      f.forEach((e, i) => (e.seq = i + 1));
    }
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_noble_secret_body_invalid");
});

test("co-delete spent owner notice and rollback every archive view cannot suppress required delivery", () => {
  const r = structuredClone(complete),
    i = r.events.findIndex((e) => e.type === "secret_body_night_notified" && e.payload.day === 4),
    old = structuredClone(r.checkpoints[3]!.nobleBody!.knowledge.body);
  expect(old.resource).toBe("intact");
  r.events.splice(i, 1);
  for (const op of r.operations) if (op.event_count! > i) op.event_count!--;
  for (const cp of r.checkpoints)
    if (cp.eventCount > i) {
      cp.eventCount--;
      cp.nobleBody!.knowledge.body = structuredClone(old);
      cp.nobleBody!.notices = cp.nobleBody!.notices.filter(
        (n) => !(n.kind === "secret_body" && n.day === 4),
      );
    }
  for (const d of r.decisions) {
    if (d.openedAtEventCount! > i) d.openedAtEventCount!--;
    d.request.context.visible_events = d.request.context.visible_events.filter(
      (f) => !(f.type === "secret_body_night_notified" && f.payload.day === 4),
    );
    d.request.context.visible_events.forEach((e, i) => (e.seq = i + 1));
  }
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_noble_secret_body_invalid");
});

test("co-tamper known state, notification and feed cannot restore the spent body", () => {
  const r = structuredClone(complete);
  for (const e of r.events)
    if (e.type === "secret_body_night_notified" && e.payload.day === 4)
      e.payload.resource = "intact";
  for (const d of r.decisions)
    for (const e of d.request.context.visible_events)
      if (e.type === "secret_body_night_notified" && e.payload.day === 4)
        e.payload.resource = "intact";
  const cp = r.checkpoints[4]!;
  cp.nobleBody!.knowledge.body.resource = "intact";
  for (const n of cp.nobleBody!.notices)
    if (n.kind === "secret_body" && n.day === 4) n.known.resource = "intact";
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_noble_secret_body_invalid");
});
for (const name of [
  "expiry",
  "new_and_old_clear",
  "two_sources",
  "pending_last_wolf",
  "badge_reveal",
])
  test(`independent Noble literal record and exact Tape ${name}`, async () => {
    const { record, replay } = await recordNobleLiteral(name);
    expect(record.finalized).toBe(true);
    expect(record.termination!.winner).toBe(Camp.Good);
    expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
  }, 30000);

for (const [name, knife, potionTarget, potionType, expected] of [
  [
    "paid-poison",
    9,
    6,
    PotionType.Poison,
    [
      [6, ["PoisonMark"]],
      [9, ["WolfKillMark"]],
    ],
  ],
  ["same-knife-poison", 6, 6, PotionType.Poison, [[6, ["WolfKillMark", "PoisonMark"]]]],
  ["same-knife-heal", 6, 6, PotionType.Heal, [[6, ["WolfKillMark", "HealMark"]]]],
  ["unresolved-demon-poison", null, 4, PotionType.Poison, [[4, ["PoisonMark"]]]],
] as const)
  test(`literal native marks before failed Seer ${name}`, async () => {
    nobleLiteralPlans[name] = [
      { body: 7, servant: null, knife: null, hunt: null, exile: 10 },
      {
        body: 8,
        servant: 6,
        knife,
        hunt: null,
        exile: null,
        potion: { target: potionTarget, type: potionType },
      },
    ];
    const { record, replay } = await recordNobleLiteral(name, "en", { failureStage: "seer" });
    const cp = record.checkpoints.at(-1)!;
    expect(cp.players.filter((p) => p.marks.length).map((p) => [p.id, p.marks])).toEqual(
      expected.map(([id, values]) => [id, [...values]]),
    );
    expect(replay.snapshot).toEqual(cp.snapshot);
    expect(
      record.events.some(
        (e) => e.type === "noble_body_native_damage_committed" && e.payload.day === 2,
      ),
    ).toBe(false);
    const forged = structuredClone(record);
    forged.checkpoints.at(-1)!.players.find((p) => p.id === potionTarget)!.marks = [];
    expect(() => parseReproductionRecord(forged)).toThrow("reproduction_noble_secret_body_invalid");
    const erased = structuredClone(record);
    erased.checkpoints.at(-1)!.settlementCount = 0;
    expect(() => parseReproductionRecord(erased)).toThrow("reproduction_noble_secret_body_invalid");
  }, 30000);

for (const badgeChoice of ["missing", "invalid"] as const)
  test(`holder choice independently preserves soft badge destruction ${badgeChoice}`, async () => {
    const { record, replay } = await recordNobleLiteral("badge_reveal", "en", { badgeChoice });
    expect(
      record.events.filter((e) => e.type === "sheriff_badge_destroyed").map((e) => e.payload),
    ).toEqual([{ targetId: 5, reason: "voted_out" }]);
    expect(record.events.some((e) => e.type === "sheriff_badge_transferred")).toBe(false);
    expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
  }, 30000);

for (const kind of ["operation", "decision", "settlement"] as const)
  test(`final checkpoint covers all actual ${kind} records`, () => {
    const forged = structuredClone(complete);
    const key = `${kind}Count` as "operationCount" | "decisionCount" | "settlementCount";
    forged.checkpoints.at(-1)![key]!--;
    expect(() => parseReproductionRecord(forged)).toThrow("reproduction_noble_secret_body_invalid");
  });

for (const type of [
  "noble_body_night_opened",
  "noble_body_knife_committed",
  "noble_body_native_damage_committed",
  "noble_body_sources_committed",
  "noble_body_death_committed",
] as const)
  for (const field of ["owner", "phase", "cursor", "payload"] as const)
    test(`independent commit evidence rejects ${type}/${field}`, () => {
      const forged = structuredClone(complete),
        op = forged.operations.find((o) => o.op === type)!;
      if (field === "owner") op.actor_id = 7;
      if (field === "phase") op.phase = "day" as any;
      if (field === "cursor") op.event_count!--;
      if (field === "payload") op.output!.policy = "invented";
      expect(() => parseReproductionRecord(forged)).toThrow(
        "reproduction_noble_secret_body_invalid",
      );
    });
for (const failureStage of [
  "secret_body",
  "night_noble",
  "wolf_discussion",
  "wolf_vote",
  "witch",
  "seer",
  "demon_hunter",
])
  test(`independent Noble failed prefix and exact Tape ${failureStage}`, async () => {
    const { record, replay } = await recordNobleLiteral("expiry", "en", { failureStage });
    expect(record.checkpoints.at(-1)!.complete).toBe(false);
    expect(record.termination!.reason).toBe("runtime_error");
    expect(replay.snapshot.gameOver).toBe(false);
  }, 30000);
