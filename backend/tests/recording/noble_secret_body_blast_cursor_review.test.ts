import { beforeAll, expect, test } from "bun:test";
import { recordNobleLiteral } from "../support/noble_secret_body_recording";
import { Phase } from "../../src/core";
import { parseReproductionRecord, type ReproductionRecord } from "../../src/recording/reproduction";
let base: ReproductionRecord;
beforeAll(async () => {
  const { record, replay } = await recordNobleLiteral("blast_skips_vote", "en", { blastDay: 2 });
  base = record;
  expect(replay.snapshot).toEqual(record.checkpoints.at(-1)!.snapshot);
});
test("literal pre-vote blast records completed Night2, actual Night3 restart, then natural completion", () => {
  const cp = base.checkpoints[2]!;
  expect(cp.cycle).toBe(2);
  expect(cp.snapshot).toEqual({ day: 3, phase: Phase.Night, gameOver: false, result: null });
  expect(cp.nobleBody!.nights.at(-1)!.day).toBe(2);
  expect(
    base.events.slice(0, cp.eventCount).findLast((e) => e.type === "phase_changed")!.payload,
  ).toEqual({ phase: "night", day: 3 });
  expect(base.decisions.some((d) => d.day === 2 && d.stage === "voting")).toBe(false);
  expect(base.checkpoints.at(-1)!.snapshot.result!.reason).toBe("all_wolves_eliminated");
  expect(() => {
    parseReproductionRecord(base);
  }).not.toThrow();
});
test("wrong restart snapshot day remains rejected", () => {
  const r = structuredClone(base);
  r.checkpoints[2]!.snapshot.day = 4;
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow("reproduction_noble_secret_body_invalid");
});
test("jointly advancing snapshot, cycle and claimed last completed Night cannot rewrite independent archive day", () => {
  const r = structuredClone(base),
    cp = r.checkpoints[2]!;
  cp.snapshot.day = 4;
  cp.cycle = 3;
  cp.nobleBody!.nights.at(-1)!.day = 3;
  expect(() => {
    parseReproductionRecord(r);
  }).toThrow("reproduction_noble_secret_body_invalid");
});
