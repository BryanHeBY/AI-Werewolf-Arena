import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { buildPresentationReplay } from "../../../src/replay/replay-presentation";

test("collapses concurrent declarations and votes into their summary events", () => {
  const replay: ReplayDocument = {
    perspective: "god",
    sessionId: "session_presentation",
    meta: { board: "twelve_player_standard", startedAt: "t1", endedAt: "t2" },
    result: { winner: null, reason: null },
    players: [],
    events: [
      { seq: 1, timestamp: "t1", day: 1, phase: "day", type: "sheriff_candidate_declared", payload: { actorId: 1, run: true } },
      { seq: 2, timestamp: "t1", day: 1, phase: "day", type: "sheriff_nomination_summary", payload: { candidates: [1] } },
      { seq: 3, timestamp: "t1", day: 1, phase: "day", type: "sheriff_vote_cast", payload: { actorId: 2, targetId: 1 } },
      { seq: 4, timestamp: "t1", day: 1, phase: "day", type: "sheriff_vote_summary", payload: { votes: [], winnerId: 1 } },
      { seq: 5, timestamp: "t2", day: 1, phase: "voting", type: "vote_cast", payload: { actorId: 1, targetId: 2 } },
      { seq: 6, timestamp: "t2", day: 1, phase: "voting", type: "vote_summary", payload: { votes: [] } },
    ],
  };

  const presentation = buildPresentationReplay(replay);
  expect(presentation.events.map((event) => event.type)).toEqual([
    "sheriff_nomination_summary",
    "sheriff_vote_summary",
    "vote_summary",
  ]);
  expect(replay.events).toHaveLength(6);
});
