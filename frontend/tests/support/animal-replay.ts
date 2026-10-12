import { readFileSync } from "node:fs";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
export const animalNames = [
  "fox_beauty",
  "cat_badge",
  "puffer_knife",
  "pk",
  "last_chain",
  "full_retaliation",
] as const;
export const loadAnimal = (name: string, suffix: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}${suffix}`, import.meta.url), "utf8"));
/** Only actual exported player events enter a masked rendering input. */
export function animalPrivateReplay(name: string, owner: string) {
  const god = readReplayDocument(loadAnimal(name, ".replay.json")),
    view = readReplayPlayerView(loadAnimal(`player-views/${name}-${owner}`, ".player.json"));
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
