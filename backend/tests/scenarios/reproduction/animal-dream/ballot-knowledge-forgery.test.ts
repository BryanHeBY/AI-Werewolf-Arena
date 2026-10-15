/**
 * Reproduction scenarios verify Animal Dream paid knowledge and PK ballot forgeries cannot rewrite original accepted actions.
 * Input: Original beforeAll fox/PK recordings and copied settlement, action, knowledge or revoter mutations.
 * Output and oracle: Explicit baseline acceptance and forgery rejection retain tied-candidate and paid-fact ordering; both shared source games remain in their original setup phase.
 */
import { beforeAll, expect, test } from "bun:test";
import { recordAnimalLiteral } from "../../../support/features/animal-dream/drivers/recording";
import { parseReproductionRecord } from "../../../../src/recording/reproduction/format";
let source: any, pk: any;
beforeAll(async () => {
  source = (await recordAnimalLiteral("fox_beauty", "en")).record;
  pk = (await recordAnimalLiteral("pk", "en")).record;
}, 10000);
const valid = (r: any) => {
  parseReproductionRecord(r);
};
const mustReject = (r: any) =>
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow();
test("A two real finalized archive baselines still accepted", () => {
  expect(() => valid(source)).not.toThrow();
  expect(() => valid(pk)).not.toThrow();
});
test("A Fox cannot settle after all later requests while its paid facts precede them", () => {
  const r = structuredClone(source),
    fox = r.decisions.find((d: any) => d.stage === "fox_distract"),
    last = r.decisions.at(-1);
  [fox.settleOrder, last.settleOrder] = [last.settleOrder, fox.settleOrder];
  mustReject(r);
});
test("A accepted knife operation cannot contradict raw action and public fact", () => {
  const r = structuredClone(source),
    op = r.operations.find((o: any) => o.op === "wolf_kill_vote_cast");
  expect(op).toBeDefined();
  op.output = { target_id: 11, abstain: false };
  mustReject(r);
});
test("A co-tampered original Beauty notice and all its copies cannot grant a cleared binding", () => {
  const r = structuredClone(source),
    event = r.events.find((e: any) => e.type === "animal_beauty_notified" && e.payload.day === 2);
  expect(event.payload.targetId).toBe(null);
  const rewrite = (e: any) => {
    if (e.type === "animal_beauty_notified" && e.payload.day === 2) {
      e.payload.targetId = 9;
      e.payload.charmAllowed = true;
      e.payload.history = [{ day: 1, targetId: 9 }];
    }
  };
  r.events.forEach(rewrite);
  r.decisions.forEach((d: any) => d.request.context.visible_events.forEach(rewrite));
  mustReject(r);
});
test("A actual PK request must use tied candidates from the real first round", () => {
  const r = structuredClone(pk),
    d = r.decisions.find((d: any) => d.day === 1 && d.stage === "exile_pk_vote");
  expect(d.request.context.exile_candidates).toEqual([6, 12]);
  d.request.context.exile_candidates = [9, 12];
  mustReject(r);
});
test("A a real PK candidate cannot replace a permitted revoter in accepted round", () => {
  const r = structuredClone(pk),
    d = r.decisions.find((d: any) => d.day === 1 && d.stage === "exile_pk_vote" && d.actorId === 5);
  expect(d).toBeDefined();
  const old = 5,
    replacement = 6,
    opening = d.openedAtEventCount;
  const summaryIndex = r.events.findIndex(
    (e: any, i: number) => i >= opening && e.type === "vote_summary" && e.payload.round === 2,
  );
  expect(summaryIndex).toBeGreaterThan(opening);
  const castIndex = r.events.findIndex(
    (e: any, i: number) =>
      i >= opening && i < summaryIndex && e.type === "vote_cast" && e.payload.actorId === old,
  );
  expect(castIndex).toBeGreaterThanOrEqual(opening);
  d.actorId = replacement;
  d.request.actorId = replacement;
  r.events[castIndex].payload.actorId = replacement;
  r.events[summaryIndex].payload.votes.find((v: any) => v.actorId === old).actorId = replacement;
  for (const op of r.operations)
    if (
      op.actor_id === old &&
      ((op.op === "vote_cast" && op.event_count === castIndex + 1) ||
        (op.op === "validate_tool_call" && op.event_count === opening && op.input?.tool === "vote"))
    )
      op.actor_id = replacement;
  for (const cp of r.checkpoints)
    if (cp.animalDream?.unit?.day === 1) {
      const round = cp.animalDream.unit.ballots.find((b: any) => b.round === 2);
      if (round) round.votes.find((v: any) => v.actorId === old).actorId = replacement;
    }
  for (const next of r.decisions)
    for (const e of next.request.context.visible_events) {
      if (e.type === "vote_cast" && e.payload.actorId === old && e.payload.abstain === true)
        e.payload.actorId = replacement;
      if (e.type === "vote_summary" && e.payload.round === 2) {
        const v = e.payload.votes.find((v: any) => v.actorId === old);
        if (v) v.actorId = replacement;
      }
    }
  mustReject(r);
});
