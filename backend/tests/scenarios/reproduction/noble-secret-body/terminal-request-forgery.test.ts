/**
 * Reproduction scenarios verify a naturally completed Noble game rejects forged post-terminal living-player requests.
 * Input: The original beforeAll expiry recording and copied terminal-request variants.
 * Output and oracle: Explicit natural completion and parser rejection preserve the actual terminal prefix; copied archives are inputs rather than independent expected-rule goldens.
 */
import { beforeAll, expect, test } from "bun:test";
import { recordNobleLiteral } from "../../../support/features/noble-secret-body/drivers/recording";
import { parseReproductionRecord, type ReproductionRecord } from "../../../../src/recording/reproduction/format";

let base: ReproductionRecord;
beforeAll(async () => {
  const fresh = await recordNobleLiteral("expiry", "en");
  base = fresh.record;
  expect(fresh.replay.snapshot).toEqual(base.checkpoints.at(-1)!.snapshot);
});
test("positive fresh expiry finishes naturally and public parser accepts", () => {
  const cp = base.checkpoints.at(-1)!;
  expect(cp.snapshot.gameOver).toBe(true);
  expect(cp.snapshot.result?.reason).not.toBe("max_days_reached");
  expect(() => parseReproductionRecord(base)).not.toThrow();
});
for (const turn of [1, 2])
  test(`public parser rejects post-game living villager vote turn ${turn}`, async () => {
    const r = structuredClone(base),
      cp = r.checkpoints.at(-1)!;
    const actor = cp.players.find((p) => p.role === "villager" && p.alive)!.id;
    const original = r.decisions.findLast(
      (d) => d.actorId === actor && d.day === cp.snapshot.day && d.stage === "voting",
    )!;
    const extra = structuredClone(original),
      feed = extra.request.context.visible_events;
    // The suffix after this villager's actual vote opens has only these literal
    // public facts plus God-only death audit evidence. No production projector.
    const publicTail = new Set([
      "phase_changed",
      "vote_summary",
      "voted_out",
      "last_words_granted",
      "last_words_spoken",
      "game_over",
    ]);
    for (const e of r.events.slice(original.openedAtEventCount!)) {
      if (!publicTail.has(e.type)) {
        expect(["vote_cast", "noble_body_death_committed"]).toContain(e.type);
        continue;
      }
      const payload = structuredClone(e.payload);
      if (e.type === "vote_summary") delete payload.tally;
      feed.push({ seq: feed.length + 1, type: e.type, payload });
    }
    extra.turn = turn;
    extra.request.phase = cp.snapshot.phase;
    extra.openedAtEventCount = r.events.length;
    extra.openedAfterSettlement = r.decisions.filter((d) => d.settleOrder !== undefined).length;
    extra.settleOrder = extra.openedAfterSettlement + 1;
    extra.outcome = {
      kind: "action",
      action: { name: "vote", args: { target_id: null, abstain: true } },
    };
    r.decisions.push(extra);
    cp.decisionCount!++;
    cp.settlementCount!++;
    expect(() => parseReproductionRecord(r)).toThrow();
  });
