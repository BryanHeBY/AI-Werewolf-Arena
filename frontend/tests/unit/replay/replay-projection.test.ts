import { expect, test } from "bun:test";
import type { ReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";

const replay: ReplayDocument = {
  perspective: "god",
  sessionId: "session_projection",
  meta: { board: "six_player_mvp", startedAt: "t1", endedAt: "t2" },
  result: { winner: null, reason: null },
  players: [
    { player_id: 1, role: "seer", camp: "good" },
    { player_id: 2, role: "wolf", camp: "wolf" },
  ],
  events: [
    { seq: 1, timestamp: "t1", day: 1, phase: "day", type: "sheriff_elected", payload: { winnerId: 1 } },
    { seq: 2, timestamp: "t1", day: 1, phase: "day", type: "voted_out", payload: { target: 1 } },
    { seq: 3, timestamp: "t2", day: 2, phase: "night", type: "sheriff_badge_transferred", payload: { fromId: 1, toId: 2 } },
  ],
};

test("projects live seats from the event history instead of final manifest state", () => {
  const beforeElimination = buildReplaySnapshot(replay, 0);
  expect(beforeElimination.players.find((player) => player.playerId === 1)?.alive).toBe(true);
  expect(beforeElimination.players.find((player) => player.playerId === 1)?.isSheriff).toBe(true);

  const afterTransfer = buildReplaySnapshot(replay, 2);
  expect(afterTransfer.players.find((player) => player.playerId === 1)?.alive).toBe(false);
  expect(afterTransfer.players.find((player) => player.playerId === 2)?.isSheriff).toBe(true);
});

test("projects self-destruct and hunter-shot targets as dead", () => {
  const deathReplay: ReplayDocument = {
    ...replay,
    players: [
      ...replay.players,
      { player_id: 3, role: "hunter", camp: "good" },
      { player_id: 4, role: "villager", camp: "good" },
    ],
    events: [
      { seq: 1, timestamp: "t1", day: 1, phase: "voting", type: "wolf_self_destruct", payload: { wolfId: 2 } },
      { seq: 2, timestamp: "t2", day: 2, phase: "day", type: "hunter_shot", payload: { hunterId: 3, targetId: 4 } },
    ],
  };

  const snapshot = buildReplaySnapshot(deathReplay, 1);
  expect(snapshot.players.find((player) => player.playerId === 2)?.alive).toBe(false);
  expect(snapshot.players.find((player) => player.playerId === 4)?.alive).toBe(false);
  expect(snapshot.players.find((player) => player.playerId === 3)?.alive).toBe(true);
});
