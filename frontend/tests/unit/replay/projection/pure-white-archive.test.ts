/**
 * Unit projection tests for pure white archive.
 * Input: existing literal or archived replay facts and their event prefixes;
 * output: original parsing, public/private state and display assertions.
 * Handwritten expectations and immutable fixture bytes are independent oracles.
 * Actual fixture lookup remains an input source; no live game executes here.
 */
import { expect, test } from "bun:test";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import wolf from "../../../fixtures/pure-white-wolf.replay.json";
import good from "../../../fixtures/pure-white-good.replay.json";
import wolfCheckpoint from "../../../fixtures/checkpoints/pure-white-wolf.json";
import goodCheckpoint from "../../../fixtures/checkpoints/pure-white-good.json";
import wolfViews from "../../../fixtures/player-views/pure-white-wolf.json";
import goodViews from "../../../fixtures/player-views/pure-white-good.json";
for (const kind of ["wolf", "good"] as const)
  test(`${kind}: frontend projection matches actual engine checkpoint and each owner sees only their inspection`, () => {
    const replay = readReplayDocument(kind === "wolf" ? wolf : good);
    const checkpoint = kind === "wolf" ? wolfCheckpoint : goodCheckpoint;
    const rawViews = kind === "wolf" ? wolfViews : goodViews;
    const snapshot = buildReplaySnapshot(replay, replay.events.length - 1);
    expect(checkpoint.complete).toBe(true);
    expect(snapshot.players.map((p) => ({ id: p.playerId, alive: p.alive }))).toEqual(
      checkpoint.players.map((p) => ({ id: p.id, alive: p.alive })),
    );
    expect(rawViews).toHaveLength(12);
    expect(rawViews.map((v) => v.player_id).sort((a, b) => a - b)).toEqual(
      checkpoint.players.map((p) => p.id).sort((a, b) => a - b),
    );
    expect(
      snapshot.players
        .filter((p) => p.isWinner)
        .map((p) => p.playerId)
        .sort((a, b) => a - b),
    ).toEqual([...checkpoint.snapshot.result.outcome.winningPlayerIds].sort((a, b) => a - b));
    const reports = replay.events.filter((e) => e.type === "role_inspected");
    for (const raw of rawViews) {
      const view = readReplayPlayerView(raw);
      const own = view.timeline.flatMap((row) =>
        row.kind === "event" && row.event.type === "role_inspected" ? [row.event.payload] : [],
      );
      const expected = reports.filter((e) => e.payload.actorId === view.player_id);
      expect(own).toHaveLength(expected.length);
      expect(own).toHaveLength(["pure_white_girl", "wolf_witch"].includes(view.role) ? 2 : 0);
      own.forEach((payload, index) => {
        expect(payload.actorId).toBe(view.player_id);
        expect(payload.targetId).toBe(expected[index]!.payload.targetId);
        expect(payload.result).toEqual(expected[index]!.payload.result);
      });
    }
  });
