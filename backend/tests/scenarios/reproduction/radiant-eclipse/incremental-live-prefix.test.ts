/**
 * Reproduction scenarios verify pending or just-settled Radiant Eclipse prefixes remain serializable against their prior complete checkpoint.
 * Input: The original top-level awaited full recording and exact day/stage/pending prefix matrix.
 * Output and oracle: Explicit full/prefix parser acceptance preserves source cut positions and setup evaluation timing; no frozen archive or expected action is regenerated.
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/radiant_eclipse_recording";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";
const full: ReproductionRecord = await radiantRecording();
function prefix(day: number, stage: string, pending: boolean) {
  const r = structuredClone(full),
    cut = r.decisions.findIndex((d) => d.day === day && d.stage === stage);
  expect(cut).toBeGreaterThanOrEqual(0);
  r.decisions = r.decisions.slice(0, cut + 1);
  if (pending) {
    r.decisions.at(-1)!.outcome = { kind: "pending" };
    delete r.decisions.at(-1)!.settleOrder;
  }
  r.finalized = false;
  r.termination = null;
  r.checkpoints = r.checkpoints.filter((c) => c.cycle < day);
  r.events = r.events.slice(0, r.checkpoints.at(-1)!.eventCount);
  r.operations = [];
  return r;
}
for (const [day, stage, pending] of [
  [1, "dreamer", true],
  [1, "dreamer", false],
  [1, "wolf_discussion", true],
  [1, "witch", true],
  [2, "dreamer", false],
  [2, "wolf_discussion", true],
] as const)
  test(`real N${day} ${stage} ${pending ? "pending" : "just settled"} prefix with prior checkpoint remains serializable`, () => {
    expect(() => {
      parseReproductionRecord(full);
    }).not.toThrow();
    const p = prefix(day, stage, pending);
    expect(() => {
      parseReproductionRecord(p);
    }).not.toThrow();
  });
