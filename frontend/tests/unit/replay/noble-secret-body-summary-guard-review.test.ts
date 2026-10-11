import { expect, test } from "bun:test";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
function row(payload: Record<string, unknown>) {
  return {
    seq: 1,
    timestamp: "2026-10-12T00:00:01.000Z",
    day: 1,
    phase: "day",
    type: "sheriff_vote_summary",
    payload,
  };
}
const ids = [1, 2, 3];
test("valid public summary gives one badge effect", () => {
  expect(readReplayEvent(row({ winnerId: 2, round: 1, votes: [] }), ids)?.effects).toEqual([
    { kind: "sheriff_elected", playerId: 2 },
  ]);
});
test("invalid trailing vote does not retain a partial badge effect", () => {
  expect(
    readReplayEvent(
      row({
        winnerId: 2,
        votes: [
          { actorId: 1, targetId: 2 },
          { actorId: 99, targetId: 2 },
        ],
      }),
      ids,
    ),
  ).toBeNull();
});
test("invalid optional extra ID does not retain a partial badge effect", () => {
  expect(readReplayEvent(row({ winnerId: 2, votes: [], target: 99 }), ids)).toBeNull();
});
test("numeric and repeated elected summaries are idempotent without role or camp changes", () => {
  const summary = row({ winnerId: 2, votes: [] });
  const snapshot = buildReplaySnapshot(
    {
      players: ids.map((player_id) => ({ player_id, role: "unknown", camp: "unknown" })),
      events: [
        summary,
        { ...summary, seq: 2 },
        { ...summary, seq: 3, type: "sheriff_elected", payload: { winnerId: 2 } },
      ],
    },
    2,
  );
  expect(snapshot.players.filter((p) => p.isSheriff).map((p) => p.playerId)).toEqual([2]);
  expect(
    snapshot.players.every((p) => p.role === "unknown" && p.camp === "unknown" && p.alive),
  ).toBe(true);
});
test("a malformed known round field cannot assign a new badge", () => {
  expect(readReplayEvent(row({ winnerId: 2, round: "not-a-round", votes: [] }), ids)).toBeNull();
});
