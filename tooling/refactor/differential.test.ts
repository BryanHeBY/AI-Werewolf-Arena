/**
 * Comparator trust tests: literal traces must expose changed stock, knowledge,
 * causal boundaries, operations, unknown diagnostics and strict replay failures.
 * Only build identity and scratch artifact addresses are intentionally distinct.
 * This is tooling verification and does not claim gameplay rule acceptance.
 */
import { expect, test } from "bun:test";
import { comparableTrace, firstDifference } from "./differential";

function trace() {
  return {
    record: {
      metadata: { engine: { sourceHash: "old", lockHash: "lock", commit: "old" }, seed: "fixed" },
      decisions: [
        {
          openedAfterSettlement: 0,
          openedAtEventCount: 2,
          settleOrder: 1,
          request: { context: { known: false } },
        },
      ],
      checkpoints: [{ operationCount: 1, stock: 2 }],
      events: [{ timestamp: 1_700_000_000_000, payload: { target: 3 }, audience: [2] }],
      operations: [{ op: "pay", status: "committed", event_count: 2 }],
    },
    strictReplay: { recordDir: "/tmp/old", decisionCount: 1, eventCount: 1 },
  };
}
test("build fingerprints and scratch paths do not replace gameplay equality", () => {
  const a = trace(),
    b = trace();
  b.record.metadata.engine.sourceHash = "new";
  b.record.metadata.engine.commit = "new";
  b.strictReplay.recordDir = "/tmp/new";
  expect(firstDifference(comparableTrace(a), comparableTrace(b))).toBeNull();
  expect(a.record.metadata.engine.sourceHash).toBe("old");
});
for (const change of [
  "stock",
  "known",
  "opening",
  "settlement",
  "operation",
  "audience",
  "unknown",
  "replay",
  "timestamp",
  "engine-id",
  "engine-unknown",
])
  test(`does not hide changed ${change}`, () => {
    const a = trace(),
      b = trace();
    if (change === "stock") b.record.checkpoints[0]!.stock--;
    if (change === "known") b.record.decisions[0]!.request.context.known = true;
    if (change === "opening") b.record.decisions[0]!.openedAtEventCount++;
    if (change === "settlement") b.record.decisions[0]!.settleOrder++;
    if (change === "operation") b.record.operations[0]!.status = "failed";
    if (change === "audience") b.record.events[0]!.audience = [3];
    if (change === "replay") b.strictReplay.decisionCount++;
    if (change === "timestamp") b.record.events[0]!.timestamp++;
    if (change === "unknown") Object.assign(b.record, { unexpectedDiagnostic: 1 });
    if (change === "engine-id") Object.assign(b.record.metadata.engine, { id: "other-engine" });
    if (change === "engine-unknown") Object.assign(b.record.metadata.engine, { newProtocol: true });
    expect(firstDifference(comparableTrace(a), comparableTrace(b))).not.toBeNull();
  });
test("missing native replay is rejected rather than skipped", () => {
  expect(() => comparableTrace({ record: { metadata: {} } })).toThrow("differential_trace_invalid");
});
