/**
 * Interaction scenarios verify Mist/Raven parallel blast responses preserve accepted and unpublished Snake prefixes.
 * Input: Original recording variants, copied unpublished response mutations and controlled mistPrefix driver calls.
 * Output and oracle: Explicit raw response, consumption and malformed-prefix rejection retain both original parallel owners; no response is synthesized or removed to repair the expected record.
 */
import { expect, test } from "bun:test";
import { Camp, ActionWindow } from "../../../../src/core";
import { parseReproductionRecord } from "../../../../src/recording/reproduction";
import { mistRecording } from "../../../support/features/mist-raven/drivers/recording";
import type { ReproductionRecord } from "../../../../src/recording/reproduction";
import { mistPrefix } from "../../../support/features/mist-raven/drivers/prefix";
for (const variant of [
  "blast-parallel",
  "blast-parallel-raw-loser",
  "blast-parallel-second-gap",
] as const)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Mist complete concurrent blast intents commit only lowest ID/${variant}/${locale}`, async () => {
      const r = await mistRecording(variant, locale);
      const intents = r.decisions.filter(
        (d) =>
          d.day === 1 && d.outcome.kind === "action" && d.outcome.action?.name === "self_destruct",
      );
      expect(intents.map((d) => d.actorId)).toEqual([10, 11]);
      expect(intents[0]!.openedAfterSettlement).toBe(intents[1]!.openedAfterSettlement);
      expect(r.events.filter((e) => e.type === "wolf_self_destruct").map((e) => e.payload)).toEqual(
        [{ wolfId: 10, window: "on_per_speech_gap" }],
      );
      const raw = variant !== "blast-parallel";
      expect(intents.map((d) => d.turn)).toEqual(
        variant === "blast-parallel-second-gap" ? [2, 2] : [1, 1],
      );
      expect(
        r.events.filter((e) => e.type === "night_resolved").map((e) => e.payload.deaths),
      ).toEqual(raw ? [[11], [12], [3, 7]] : [[5], [11], [3, 7]]);
      expect(
        r.decisions.find((d) => d.day === 1 && d.stage === "alchemist_snake")!.request.context
          .snake_candidates,
      ).toEqual(raw ? [11] : [5]);
      expect(r.checkpoints.at(-1)!.snapshot.result?.winner).toBe(Camp.Good);
      expect(
        r.checkpoints
          .at(-1)!
          .players.filter((p) => p.alive)
          .map((p) => p.id),
      ).toEqual(raw ? [1, 2, 4, 5, 6] : [1, 2, 4, 6, 8]);
      const bad = structuredClone(r);
      bad.decisions.find(
        (d) =>
          d.day === 1 &&
          d.actorId === 11 &&
          d.outcome.kind === "action" &&
          d.outcome.action?.name === "self_destruct",
      )!.turn++;
      expect(() => parseReproductionRecord(bad)).toThrow("reproduction_mist_raven_invalid");
      const premature = structuredClone(r);
      premature.decisions.find(
        (d) => d.day === 1 && d.stage === "alchemist_snake",
      )!.openedAfterSettlement = intents[0]!.settleOrder!;
      expect(() => parseReproductionRecord(premature)).toThrow("reproduction_mist_raven_invalid");
    }, 120000);

async function unpublished() {
  const r = structuredClone(await mistRecording("blast-parallel-raw-loser"));
  const index = r.decisions.findIndex((d) => d.day === 1 && d.stage === "alchemist_snake");
  r.decisions = r.decisions.slice(0, index + 1);
  r.decisions.at(-1)!.outcome = { kind: "pending" };
  delete r.decisions.at(-1)!.settleOrder;
  r.checkpoints = r.checkpoints.slice(0, 1);
  r.events = r.events.slice(0, r.checkpoints[0]!.eventCount);
  r.finalized = false;
  r.termination = null;
  r.operations = [];
  return r;
}
const batch = (r: ReproductionRecord) =>
  r.decisions.filter((d) => d.day === 1 && d.stage === "on_per_speech_gap");
test("Mist unpublished parallel Snake prefix preserves the completed null response", async () => {
  const r = await unpublished();
  expect(batch(r).map((d) => d.actorId)).toEqual([10, 11, 12]);
  expect(() => parseReproductionRecord(r)).not.toThrow();
});
for (const actor of [11, 12])
  for (const mode of ["pending", "error"] as const)
    test(`Mist unpublished Snake rejects incomplete blast batch ${actor}/${mode}`, async () => {
      const r = await unpublished(),
        changed = batch(r).find((d) => d.actorId === actor)!;
      if (mode === "error")
        changed.outcome = { kind: "error", code: "decision_failed", name: "Error" };
      else {
        const order = changed.settleOrder!;
        changed.outcome = { kind: "pending" };
        delete changed.settleOrder;
        for (const d of r.decisions) {
          if (d.openedAfterSettlement >= order) d.openedAfterSettlement--;
          if (d.settleOrder !== undefined && d.settleOrder > order) d.settleOrder--;
        }
      }
      expect(() => parseReproductionRecord(r)).toThrow("reproduction_mist_raven_invalid");
    });
for (const mutation of [
  "wrong-window",
  "missing-window",
  "pending-other-round",
  "pending-other-opening",
] as const)
  test(`Mist unpublished blast batch identity cannot omit a peer/${mutation}`, async () => {
    const r = await unpublished();
    if (mutation === "wrong-window")
      for (const d of batch(r)) d.request.actionWindow = ActionWindow.OnDaybreak;
    else if (mutation === "missing-window") for (const d of batch(r)) delete d.request.actionWindow;
    else {
      const peer = batch(r).find((d) => d.actorId === 12)!;
      peer.outcome = { kind: "pending" };
      delete peer.settleOrder;
      if (mutation === "pending-other-round") peer.turn++;
      else peer.openedAfterSettlement--;
    }
    expect(() => parseReproductionRecord(r)).toThrow("reproduction_mist_raven_invalid");
  });
test("Mist unpublished Snake cannot follow only the winner's response", async () => {
  const p = await mistPrefix("alchemist_snake", 1, false, undefined, (q) =>
    q.context.stage === "on_pre_election" && [10, 11].includes(q.actorId)
      ? { name: "self_destruct", args: { confirm: true, reason: "Concurrent" } }
      : undefined,
  );
  expect(() => parseReproductionRecord(p.pending)).not.toThrow();
  const r = structuredClone(p.pending),
    winner = r.decisions.find((d) => d.stage === "on_pre_election" && d.actorId === 10)!;
  r.decisions.at(-1)!.openedAfterSettlement = winner.settleOrder!;
  expect(() => parseReproductionRecord(r)).toThrow("reproduction_mist_raven_invalid");
});
