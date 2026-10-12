/**
 * Reproduction scenarios verify Radiant Eclipse full and pending request prefixes preserve private knowledge and predecessor settlement authority.
 * Input: The original top-level awaited full recording, copied pending prefix and named raw/action/source-history forgeries.
 * Output and oracle: Explicit baseline acceptance and exact rejection code retain the shared game setup and original request sequence; generated records remain inputs, not new expected-rule goldens.
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/radiant_eclipse_recording";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction";
const full: ReproductionRecord = await radiantRecording();
function clone() {
  return structuredClone(full);
}
function pending() {
  const r = clone(),
    cut = r.decisions.findIndex((d) => d.day === 2 && d.stage === "witch");
  r.decisions = r.decisions.slice(0, cut + 1);
  r.decisions.at(-1)!.outcome = { kind: "pending" };
  delete r.decisions.at(-1)!.settleOrder;
  r.finalized = false;
  r.termination = null;
  r.checkpoints = r.checkpoints.filter((c) => c.cycle <= 1);
  r.events = r.events.slice(0, r.checkpoints.at(-1)!.eventCount);
  r.operations = [];
  return r;
}
function rejection(
  name: string,
  seed: () => ReproductionRecord,
  mutate: (r: ReproductionRecord) => void,
) {
  test(name, () => {
    const r = seed();
    expect(() => parseReproductionRecord(r)).not.toThrow();
    mutate(r);
    expect(() => parseReproductionRecord(r)).toThrow("reproduction_radiant_eclipse_invalid");
  });
}
test("actual finalized four-night and legitimate copied-Witch pending baselines pass", () => {
  expect(() => parseReproductionRecord(full)).not.toThrow();
  expect(() => parseReproductionRecord(pending())).not.toThrow();
});
rejection("full: unrelated Seer request may not carry private wolf_target", clone, (r) => {
  r.decisions.find((d) => d.day === 2 && d.stage === "seer")!.request.context.wolf_target = 8;
});
rejection("full: exact swallow raw JSON forbids unrecognized properties", clone, (r) => {
  const d = r.decisions.find((d) => d.day === 2 && d.stage === "eclipse_swallow")!;
  if (d.outcome.kind === "action" && d.outcome.action)
    (d.outcome.action.args as any).secret = "CANARY_RAW_EXTRA_14967";
});
rejection("full: downstream shelter may not open before swallow settles", clone, (r) => {
  r.decisions.find((d) => d.day === 2 && d.stage === "radiant_shelter")!.openedAfterSettlement = 0;
});
rejection(
  "pending: a settled predecessor with an illegal dream target cannot authorize a later Witch",
  pending,
  (r) => {
    const d = r.decisions.find((d) => d.day === 2 && d.stage === "dreamer")!;
    if (d.outcome.kind === "action" && d.outcome.action)
      (d.outcome.action.args as any).target_id = d.actorId;
  },
);
rejection("pending: a pending shelter predecessor cannot authorize a later Witch", pending, (r) => {
  const d = r.decisions.find((d) => d.day === 2 && d.stage === "radiant_shelter")!;
  d.outcome = { kind: "pending" };
  delete d.settleOrder;
});
rejection("pending: a failed shelter predecessor cannot authorize a later Witch", pending, (r) => {
  r.decisions.find((d) => d.day === 2 && d.stage === "radiant_shelter")!.outcome = {
    kind: "error",
    code: "decision_failed",
    name: "Error",
  };
});
rejection(
  "pending: removing the mandatory shelter opportunity cannot leave successors",
  pending,
  (r) => {
    r.decisions = r.decisions.filter((d) => !(d.day === 2 && d.stage === "radiant_shelter"));
  },
);
rejection(
  "pending: existing borrowed grant DTO forbids source-history canary fields",
  pending,
  (r) => {
    const e = r.decisions
      .at(-1)!
      .request.context.visible_events.find((e) => e.type === "ability_changed")!;
    (e.payload as any).originalHistory = "CANARY_ORIGINAL_HISTORY_81234";
  },
);
rejection("pending: a potion borrower cannot see an invented own Seer result", pending, (r) => {
  const v = r.decisions.at(-1)!.request.context.visible_events;
  v.push({
    seq: v.length + 1,
    type: "seer_checked",
    payload: {
      actorId: 1,
      targetId: 12,
      isWerewolf: true,
      result: { kind: "camp", camp: "wolf" },
      canary: "CANARY_UNEARNED_RESULT_84931",
    },
  } as any);
});
rejection(
  "pending: future game_over fact cannot be appended to an unfinished Witch view",
  pending,
  (r) => {
    const v = r.decisions.at(-1)!.request.context.visible_events;
    v.push({
      seq: v.length + 1,
      type: "game_over",
      payload: { winner: "good", reason: "CANARY_FUTURE_WINNER_66183" },
    } as any);
  },
);
rejection("full: wrong borrowed ability ID remains rejected", clone, (r) => {
  r.decisions.find((d) => d.day === 2 && d.stage === "witch")!.request.context.ability_id =
    "native:potion";
});
