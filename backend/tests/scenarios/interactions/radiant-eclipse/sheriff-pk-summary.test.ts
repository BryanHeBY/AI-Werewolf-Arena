/**
 * Interaction scenarios verify an actual sheriff primary tie and completed PK retain the first summary in later PK speech requests.
 * Input: Original candidate/vote choices and the existing Radiant Eclipse recording provider.
 * Output and oracle: Explicit speech/vote counters and visible-summary assertions retain election timing; no generic vote engine or regenerated expectation is used.
 */
import { expect, test } from "bun:test";
import { radiantRecording } from "../../../support/radiant_eclipse_recording";
test("real primary sheriff tie and completed PK keeps first summary visible in PK speech requests", async () => {
  let pkSpeeches = 0,
    pkVotes = 0;
  const record = await radiantRecording({
    failureStage: "eclipse_swallow",
    failureMode: "missing",
    provider: (_game, manual) => ({
      getAction: async (q) => {
        if (q.context.day === 1) {
          if (q.context.stage === "sheriff_nomination" || q.context.stage === "sheriff_withdraw")
            return { name: "run_for_sheriff", args: { run: q.actorId === 2 || q.actorId === 3 } };
          if (q.context.stage === "sheriff_vote")
            return {
              name: "vote_for_sheriff",
              args: { target_id: [1, 4, 5, 6, 7].includes(q.actorId) ? 2 : 3, abstain: false },
            };
          if (q.context.stage === "sheriff_pk_speech") {
            pkSpeeches++;
            return { name: "speak", args: { text: "PK candidate speech" } };
          }
          if (q.context.stage === "sheriff_pk_vote") {
            pkVotes++;
            return { name: "vote_for_sheriff", args: { target_id: 2, abstain: false } };
          }
          if (q.context.stage === "sheriff_choose_direction")
            return { name: "choose_direction", args: { direction: "clockwise" } };
        }
        return manual.getAction(q);
      },
    }),
  });
  expect(pkSpeeches).toBeGreaterThan(0);
  expect(pkVotes).toBeGreaterThan(0);
  expect(record.finalized).toBe(true);
  expect(record.termination?.reason).toBe("runtime_error");
  const p = record.decisions.find((d) => d.stage === "sheriff_pk_speech")!;
  expect(p.request.context.visible_events.some((e) => e.type === "sheriff_vote_summary")).toBe(
    true,
  );
});
