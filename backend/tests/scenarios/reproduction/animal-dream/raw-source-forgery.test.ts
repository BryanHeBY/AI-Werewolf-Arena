/**
 * Reproduction scenarios verify Animal Dream raw accepted actions, logic evidence and paid facts resist consistent-looking archive forgeries.
 * Input: The original beforeAll natural game recording and copied raw-vote, winner-neutral badge or Fox co-deletion mutations.
 * Output and oracle: Explicit original acceptance and malformed-prefix rejection remain tied to actual recording; the source baseline is not promoted to independent expected-rule output.
 */
import { beforeAll, expect, test } from "bun:test";
import { recordAnimalLiteral } from "../../../support/features/animal-dream/drivers/recording";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
let baseline: any;
beforeAll(async () => {
  const real = await recordAnimalLiteral("fox_beauty", "en");
  baseline = real.record;
}, 10000);
const copy = () => structuredClone(baseline);
test("A source baseline is a real natural finalized Record+Tape", () => {
  expect(baseline.finalized).toBe(true);
  expect(() => parseReproductionRecord(copy())).not.toThrow();
});
test("A raw kill action cannot disagree with accepted vote and lethal wave", () => {
  const r = copy(),
    d = r.decisions.find(
      (d: any) =>
        d.day === 3 && d.outcome.kind === "action" && d.outcome.action?.name === "kill_vote",
    );
  expect(d).toBeDefined();
  d.outcome.action.args.target_id = 5;
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("A raw public ballot cannot disagree with accepted round", () => {
  const r = copy(),
    d = r.decisions.find(
      (d: any) =>
        d.day === 1 &&
        d.stage === "voting" &&
        d.outcome.kind === "action" &&
        d.outcome.action?.name === "vote",
    );
  expect(d).toBeDefined();
  d.outcome.action.args.target_id = 5;
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("A full finalized archive cannot discard every logic operation", () => {
  const r = copy();
  expect(r.operations.length).toBeGreaterThan(0);
  r.operations = [];
  for (const cp of r.checkpoints) cp.operationCount = 0;
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("A finalized archive cannot contain forged winner-neutral badge state", () => {
  const r = copy();
  const p = r.checkpoints.at(-1).players.find((p: any) => p.id === 5);
  p.badge.hasBadge = true;
  expect(() => parseReproductionRecord(r)).toThrow();
});
test("A co-deleted Fox action+published receipt+rolled stock cannot erase mandatory N2 choice", () => {
  const r = copy(),
    removedDecision = r.decisions.findIndex((d: any) => d.day === 2 && d.stage === "fox_distract");
  expect(removedDecision).toBeGreaterThanOrEqual(0);
  const settle = r.decisions[removedDecision].settleOrder;
  const removedEvents = r.events
    .map((e: any, i: number) =>
      e.type === "animal_fox_chosen" || e.type === "animal_fox_effect" ? i : -1,
    )
    .filter((i: number) => i >= 0);
  expect(removedEvents.length).toBe(2);
  const cursor = (n: number) => n - removedEvents.filter((i: number) => i < n).length;
  r.events = r.events.filter((_: unknown, i: number) => !removedEvents.includes(i));
  const rewrite = (e: any) => {
    if (e.type === "animal_knife_notified" && e.payload.day === 2) e.payload.eligible = true;
    if (e.type === "animal_beauty_notified" && e.payload.day === 2) {
      e.payload.charmAllowed = true;
      e.payload.targetId = 5;
    }
  };
  for (const e of r.events) rewrite(e);
  r.decisions.splice(removedDecision, 1);
  for (const d of r.decisions) {
    d.openedAtEventCount = cursor(d.openedAtEventCount);
    if (d.settleOrder > settle) d.settleOrder--;
    if (d.openedAfterSettlement >= settle) d.openedAfterSettlement--;
    d.request.context.visible_events = d.request.context.visible_events.filter(
      (e: any) => e.type !== "animal_fox_chosen",
    );
    d.request.context.visible_events.forEach((e: any, i: number) => {
      e.seq = i + 1;
      rewrite(e);
    });
  }
  for (const cp of r.checkpoints) {
    cp.eventCount = cursor(cp.eventCount);
    if (cp.decisionCount > removedDecision) cp.decisionCount--;
    if (cp.settlementCount >= settle) cp.settlementCount--;
    cp.animalDream.fox = { policy: "awa_animal_dream_v1", usedNight: null, history: [] };
    cp.animalDream.effect = null;
    cp.players.find((p: any) => p.id === 10).privateState.foxCub = structuredClone(
      cp.animalDream.fox,
    );
  }
  expect(() => parseReproductionRecord(r)).toThrow();
});
