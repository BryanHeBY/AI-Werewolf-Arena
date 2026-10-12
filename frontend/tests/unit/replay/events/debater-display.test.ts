/**
 * Unit tests verify debater fact acceptance, display labels.
 * Input: the original literal facts, malformed payloads and case tables with explicit display locale.
 * Output: the original fact acceptance, display labels assertions.
 * Handwritten field, label and effect expectations are the independent oracle.
 * Existing case tables remain unchanged; no live game executes or golden regenerates.
 */
import { expect, test } from "bun:test";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
const event = (type: string, payload: Record<string, unknown>): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-10-09T00:00:00Z",
  phase: "day",
  day: 1,
  type,
  payload,
});
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: living revelation and public aggregate, God false/null, unknown voters`, () => {
    const reveal = event("debater_revealed", { actorId: 1, day: 1 });
    expect(readReplayEvent(reveal, [1, 2, 3])?.effects).toEqual([
      { kind: "role_revealed", playerId: 1, role: "debater" },
    ]);
    expect(eventLabel(reveal, locale, [1, 2, 3])).toContain("1");
    const result = event("debate_resolved", {
      actorId: 1,
      targetId: 2,
      day: 1,
      eligibleCount: 3,
      supports: 1,
      rejects: 1,
      abstentions: 1,
      success: false,
      blockedId: 1,
    });
    expect(readReplayEvent(result, [1, 2, 3])).not.toBeNull();
    expect(eventLabel(result, locale, [1, 2, 3])).not.toContain("undefined");
    const ballots = {
      actorId: 1,
      targetId: 2,
      day: 1,
      eligibleCount: 3,
      ballots: [
        { voterId: 1, support: true },
        { voterId: 2, support: false },
        { voterId: 3, support: null },
      ],
    };
    expect(readReplayEvent(event("debate_ballots_recorded", ballots), [1, 2, 3])).not.toBeNull();
    expect(
      readReplayEvent(
        event("debate_ballots_recorded", {
          ...ballots,
          ballots: [...ballots.ballots.slice(0, 2), { voterId: 999, support: null }],
        }),
        [1, 2, 3],
      ),
    ).toBeNull();
    expect(
      readReplayEvent(
        event("debate_resolved", { ...result.payload, ballots: ballots.ballots }),
        [1, 2, 3],
      ),
    ).toBeNull();
    let reads = 0;
    expect(
      readReplayEvent(
        event("debater_revealed", {
          actorId: 1,
          get day() {
            reads++;
            return 1;
          },
        }),
        [1, 2, 3],
      ),
    ).toBeNull();
    expect(reads).toBe(0);
  });
