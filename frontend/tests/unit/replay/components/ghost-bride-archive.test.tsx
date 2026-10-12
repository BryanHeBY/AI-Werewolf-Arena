/**
 * Unit component tests for ghost bride archive replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { ghostBrideEventLabel, roleName } from "@ai-werewolf-arena/game-text";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
for (const kind of ["good", "wolf", "pair", "witness"])
  for (const actor of ["god", "bride", "groom", "witness", "pack"])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${kind}/${actor}/${locale}: actual archive to strict private reader and minimal shared frame preserves native identity`, () => {
        const god = readReplayDocument(
          JSON.parse(
            readFileSync(
              new URL(`../../../fixtures/ghost-bride-${kind}.replay.json`, import.meta.url),
              "utf8",
            ),
          ),
        );
        const view =
          actor === "god"
            ? null
            : readReplayPlayerView(
                JSON.parse(
                  readFileSync(
                    new URL(
                      `../../../fixtures/player-views/ghost-bride-${kind}-${actor}.player.json`,
                      import.meta.url,
                    ),
                    "utf8",
                  ),
                ),
              );
        const events = view
          ? view.timeline.flatMap((row) =>
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
          : god.events;
        if (actor === "witness")
          expect(
            events.some((e) =>
              ["ghost_bride_partner_chat", "ghost_bride_witness_vote"].includes(e.type),
            ),
          ).toBe(false);
        if (actor === "pack")
          expect(events.some((e) => e.type.startsWith("ghost_bride_"))).toBe(false);
        const replay = readReplayDocument({
          ...god,
          players: god.players.map((p) => ({
            ...p,
            role: !view || p.player_id === view.player_id ? p.role : "unknown",
            camp: !view || p.player_id === view.player_id ? p.camp : "unknown",
          })),
          events: events.map((e, i) => ({ ...e, seq: i + 1 })),
        });
        const index = replay.events.findIndex((e) =>
          actor === "pack"
            ? e.type === "wolf_kill_vote_cast"
            : e.type === "ghost_bride_group_chosen",
        );
        expect(index).toBeGreaterThanOrEqual(0);
        const event = replay.events[index]!,
          before = buildReplaySnapshot(replay, index - 1),
          after = buildReplaySnapshot(replay, index);
        expect(after.players).toEqual(before.players);
        if (view) {
          expect(after.players.find((p) => p.playerId === view.player_id)).toMatchObject({
            role: view.role,
            camp: view.camp,
            alive: true,
          });
          expect(
            after.players
              .filter((p) => p.playerId !== view.player_id)
              .every((p) => p.role === "unknown" && p.camp === "unknown"),
          ).toBe(true);
        }
        const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
          frame = input.replay.events.findIndex((e) => e.seq === event.seq) * 90 + 15;
        expect(buildReplayFrame(input, frame).snapshot.players).toEqual(after.players);
        const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
        expect(markup).not.toContain("undefined");
        if (view) expect(markup).toContain(roleName(view.role as never, locale));
        if (actor !== "pack")
          expect(ghostBrideEventLabel(event.type, event.payload, locale)).toContain(
            locale === "en" ? "Wedding group" : "婚礼三方",
          );
        for (const fact of events.filter((e) => e.type.startsWith("ghost_bride_")))
          expect(
            readReplayEvent(
              fact,
              god.players.map((p) => p.player_id),
            ),
          ).not.toBeNull();
      });

for (const kind of ["night-win", "all-dead"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${kind}/${locale}: actual terminal Night replay projects the final checkpoint lives and original identities`, () => {
      const replay = readReplayDocument(
        JSON.parse(
          readFileSync(
            new URL(`../../../fixtures/ghost-bride-${kind}.replay.json`, import.meta.url),
            "utf8",
          ),
        ),
      );
      replay.meta.locale = locale;
      const cp = JSON.parse(
        readFileSync(
          new URL(`../../../fixtures/checkpoints/ghost-bride-${kind}.json`, import.meta.url),
          "utf8",
        ),
      );
      const snapshot = buildReplaySnapshot(replay, replay.events.length - 1);
      expect(
        snapshot.players.map((p) => ({
          id: p.playerId,
          alive: p.alive,
          role: p.role,
          camp: p.camp,
        })),
      ).toEqual(
        cp.players.map((p: any) => ({ id: p.id, alive: p.alive, role: p.role, camp: p.camp })),
      );
      expect(snapshot.decision?.decidedAt.phase).toBe("night");
      const input = createReplayRenderInput(replay);
      const frameNumber = (input.replay.events.length - 1) * 90 + 15,
        frame = buildReplayFrame(input, frameNumber);
      expect(frame.snapshot.players.filter((p) => p.alive).map((p) => p.playerId)).toEqual(
        cp.players.filter((p: any) => p.alive).map((p: any) => p.id),
      );
      expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frameNumber} />)).toContain(
        kind === "all-dead"
          ? locale === "en"
            ? "No winner"
            : "无胜者"
          : locale === "en"
            ? "Third party"
            : "第三方",
      );
    });
