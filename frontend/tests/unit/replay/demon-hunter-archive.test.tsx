import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { roleName } from "@ai-werewolf-arena/game-text";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../src/replay/ReplayComposition";
const read = (file: string) =>
  JSON.parse(readFileSync(new URL(`../../fixtures/${file}`, import.meta.url), "utf8"));
for (const size of [6, 12])
  for (const goal of ["slaughter_city", "slaughter_side"])
    for (const scope of ["god", "owner"])
      for (const locale of ["zh-CN", "en"] as const)
        test(`${size}/${goal}/${scope}/${locale}: actual strict archive has no fact damage and native identity survives shared frame`, () => {
          const key = `demon-hunter-${size}-${goal}`,
            god = readReplayDocument(read(`${key}.replay.json`)),
            view = readReplayPlayerView(read(`player-views/${key}.player.json`));
          const replay = readReplayDocument({
            ...god,
            players: god.players.map((p) => ({
              ...p,
              role: scope === "god" || p.player_id === view.player_id ? p.role : "unknown",
              camp: scope === "god" || p.player_id === view.player_id ? p.camp : "unknown",
            })),
            events:
              scope === "god"
                ? god.events
                : view.timeline
                    .flatMap((row) =>
                      row.kind === "event"
                        ? [
                            {
                              seq: row.seq,
                              timestamp: row.timestamp!,
                              phase: row.phase,
                              day: row.day,
                              type: row.event.type,
                              payload: row.event.payload,
                            },
                          ]
                        : [],
                    )
                    .map((e, i) => ({ ...e, seq: i + 1 })),
          });
          replay.events = replay.events.map((e, i) => ({ ...e, seq: i + 1 }));
          const index = replay.events.findIndex((e) => e.type === "demon_hunter_chosen"),
            chosen = replay.events[index]!;
          expect(index).toBeGreaterThanOrEqual(0);
          expect(buildReplaySnapshot(replay, index).players).toEqual(
            buildReplaySnapshot(replay, index - 1).players,
          );
          if (scope === "owner") {
            expect(chosen.payload).not.toHaveProperty("actorId");
            expect(
              replay.events.some((e) =>
                ["demon_hunter_cancelled", "demon_hunter_poison_immune"].includes(e.type),
              ),
            ).toBe(false);
            expect(
              buildReplaySnapshot(replay, index)
                .players.filter((p) => p.playerId !== view.player_id)
                .every((p) => p.role === "unknown" && p.camp === "unknown"),
            ).toBe(true);
          }
          const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
            frame = input.replay.events.findIndex((e) => e.seq === chosen.seq) * 90 + 15;
          expect(buildReplayFrame(input, frame).snapshot.players).toEqual(
            buildReplaySnapshot(replay, index).players,
          );
          const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
          expect(markup).toContain(roleName("demon_hunter", locale));
          expect(markup).not.toContain("undefined");
        });
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: actual full terminal Night has all original deaths and dead Good winner`, () => {
    const replay = readReplayDocument(read("demon-hunter-terminal.replay.json")),
      cp = read("checkpoints/demon-hunter-terminal.json");
    const snapshot = buildReplaySnapshot(replay, replay.events.length - 1);
    expect(
      snapshot.players.map((p) => ({ id: p.playerId, alive: p.alive, role: p.role, camp: p.camp })),
    ).toEqual(
      cp.players.map((p: any) => ({ id: p.id, alive: p.alive, role: p.role, camp: p.camp })),
    );
    expect(snapshot.decision?.decidedAt.phase).toBe("night");
    const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
      frame = (replay.events.length - 1) * 90 + 15;
    expect(buildReplayFrame(input, frame).snapshot.players).toEqual(snapshot.players);
    expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(
      roleName("demon_hunter", locale),
    );
  });
