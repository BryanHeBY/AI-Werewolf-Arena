/**
 * Provides Fragrant replay fixtures to unit and browser integration tests.
 * Inputs are registered archive names/suffixes and an owner player-view name;
 * outputs are freshly parsed files or a masked replay assembled from that
 * owner's exported events. This test-support loader owns filesystem reads and
 * fixture selection only, with no production visibility projection or rule
 * execution.
 */
import { frontendFixtureURL } from "./fixtures/manifest";
import { readFileSync } from "node:fs";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
export const fragrantNames = [
  "inherited_gun",
  "first_link",
  "expiry",
  "dead_caster",
  "same_wave",
] as const;
export const loadFragrant = (name: string, suffix: string) =>
  JSON.parse(readFileSync(frontendFixtureURL(`frontend/tests/fixtures/${name}${suffix}`), "utf8"));
/** Only actual exported player events enter a masked rendering input. */
export function fragrantPrivateReplay(name: string, owner: string) {
  const god = readReplayDocument(loadFragrant(name, ".replay.json")),
    view = readReplayPlayerView(loadFragrant(`player-views/${name}-${owner}`, ".player.json"));
  return readReplayDocument({
    ...god,
    result: { winner: null, reason: "private_render" },
    players: god.players.map((p) => ({
      ...p,
      role: p.player_id === view.player_id ? view.role : "unknown",
      camp: p.player_id === view.player_id ? view.camp : "unknown",
    })),
    events: view.timeline
      .flatMap((row) =>
        row.kind === "event"
          ? [
              {
                seq: row.seq,
                timestamp: row.timestamp!,
                day: row.day,
                phase: row.phase,
                type: row.event.type,
                payload: row.event.payload,
              },
            ]
          : [],
      )
      .map((e, i) => ({ ...e, seq: i + 1 })),
  });
}
