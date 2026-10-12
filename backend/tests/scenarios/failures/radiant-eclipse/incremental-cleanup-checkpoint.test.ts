/**
 * Failure scenarios verify an incremental Radiant Eclipse checkpoint retains completed cleanup after a real cycle failure.
 * Input: A recorded Seer-failure cycle and the original copied checkpoint/lease mutations.
 * Output and oracle: Explicit parser acceptance or rejection distinguishes completed cleanup from a forged active lease; the generated record is input, not an independent expected-state oracle.
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/radiant_eclipse_recording";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
async function checkpointedFailure(): Promise<any> {
  const r = await radiantRecording({ failureStage: "seer" });
  r.finalized = false;
  r.termination = null;
  r.operations = [];
  return r;
}
test("actual failed cycle checkpoint before finalization retains its completed cleanup", async () => {
  const r = await checkpointedFailure();
  expect(() => parseReproductionRecord(r)).not.toThrow();
});
test("already failed cycle checkpoint cannot retain active lease merely because file is incremental", async () => {
  const r = await checkpointedFailure();
  const i = r.events.findIndex(
    (e: any) => e.type === "eclipse_lease_closed" && e.payload.day === 2,
  );
  r.events.splice(i, 1);
  for (const cp of r.checkpoints) if (cp.eventCount > i) cp.eventCount--;
  const ps = r.checkpoints.at(-1).players;
  ps.find((p: any) => p.id === 1).privateState.abilities["copy:eclipse:night:2"].disabled = false;
  ps.find((p: any) => p.id === 4).privateState.abilities["native:potion"].nightSuppression = {
    policy: "awa_radiant_eclipse_v1",
    day: 2,
  };
  let accepted = false;
  try {
    parseReproductionRecord(r);
    accepted = true;
  } catch {}
  expect(accepted).toBe(false);
});
