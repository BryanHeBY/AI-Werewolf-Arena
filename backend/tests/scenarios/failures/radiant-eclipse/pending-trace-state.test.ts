/**
 * Failure scenarios verify pending Radiant Eclipse traces use the prior complete checkpoint and current unarchived request.
 * Input: The real Seer-failure recording and original incremental or finalized terminal-request mutations.
 * Output and oracle: Explicit parser acceptance and rejection preserve pending/finalized distinctions; the original record is not rewritten as a new golden.
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/radiant_eclipse_recording";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
async function failed(): Promise<any> {
  return await radiantRecording({ failureStage: "seer" });
}
test("legitimate pending Trace uses only previous complete checkpoint and current unarchived requests", async () => {
  const r = await failed();
  r.finalized = false;
  r.termination = null;
  r.operations = [];
  r.checkpoints.pop();
  r.events = r.events.slice(0, r.checkpoints.at(-1).eventCount);
  r.decisions.at(-1).outcome = { kind: "pending" };
  delete r.decisions.at(-1).settleOrder;
  expect(() => parseReproductionRecord(r)).not.toThrow();
});
test("a finalized failed archive cannot still contain a pending terminal request", async () => {
  const r = await failed();
  r.decisions.at(-1).outcome = { kind: "pending" };
  delete r.decisions.at(-1).settleOrder;
  let accepted = false;
  try {
    parseReproductionRecord(r);
    accepted = true;
  } catch {}
  expect(accepted).toBe(false);
});
