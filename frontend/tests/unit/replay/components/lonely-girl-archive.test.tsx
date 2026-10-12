/**
 * Unit component tests for lonely girl archive replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument, readReplayPlayerView } from "@ai-werewolf-arena/replay-contract";
import { roleName } from "@ai-werewolf-arena/game-text";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { eventLabel } from "../../../../src/replay/event-labels";
for (const name of ["6-good_dead", "6-hunter_chain", "6-wolf_needs_girl", "12-wolf_win"])
  for (const locale of ["zh-CN", "en"] as const)
    for (const privateActor of [false, true])
      test(`${name}/${locale}/${privateActor}: actual admiration archive retains original civilian identity in shared frame`, () => {
        const god = readReplayDocument(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(`frontend/tests/fixtures/lonely-girl-${name}.replay.json`),
              "utf8",
            ),
          ),
        );
        const view = readReplayPlayerView(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(`frontend/tests/fixtures/player-views/lonely-girl-${name}.player.json`),
              "utf8",
            ),
          ),
        );
        const own = view.timeline.filter(
          (row) => row.kind === "event" && row.event.type === "lonely_girl_admired_chosen",
        );
        expect(own).toHaveLength(1);
        const row = own[0]!;
        if (row.kind !== "event") throw new Error("missing_fact");
        expect(row.event.payload).toEqual({
          policy: "awa_netease_lonely_girl_v1",
          actorId: view.player_id,
          day: 1,
          targetId: row.event.payload.targetId,
        });
        const doc = privateActor
          ? readReplayDocument({
              ...god,
              players: god.players.map((p) => ({
                ...p,
                role: p.player_id === view.player_id ? view.role : "unknown",
                camp: p.player_id === view.player_id ? view.camp : "unknown",
              })),
              events: [
                {
                  seq: 1,
                  timestamp: "2026-10-09T00:00:00Z",
                  phase: "night",
                  day: 1,
                  type: "phase_changed",
                  payload: { phase: "night", day: 1 },
                },
                {
                  seq: 2,
                  timestamp: row.timestamp ?? "2026-10-09T00:00:00Z",
                  phase: row.phase,
                  day: row.day,
                  type: row.event.type,
                  payload: row.event.payload,
                },
              ],
            })
          : god;
        const original = JSON.stringify(doc),
          index = doc.events.findIndex((e) => e.type === "lonely_girl_admired_chosen"),
          fact = doc.events[index]!,
          before = buildReplaySnapshot(doc, index - 1),
          after = buildReplaySnapshot(doc, index);
        expect(after.players).toEqual(before.players);
        expect(after.players.find((p) => p.playerId === view.player_id)).toMatchObject({
          role: "lonely_girl",
          camp: "good",
          alive: true,
          isSheriff: false,
        });
        if (privateActor)
          expect(
            after.players
              .filter((p) => p.playerId !== view.player_id)
              .every((p) => p.role === "unknown" && p.camp === "unknown"),
          ).toBe(true);
        const input = createReplayRenderInput(doc, { locale, timeZone: "UTC" }),
          frame = input.replay.events.findIndex((e) => e.seq === fact.seq) * 90 + 15,
          markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
        expect(buildReplayFrame(input, frame).snapshot.players).toEqual(after.players);
        expect(markup).toContain(roleName("lonely_girl", locale));
        expect(markup).not.toContain("undefined");
        expect(
          eventLabel(
            fact,
            locale,
            doc.players.map((p) => p.player_id),
          ),
        ).toContain(locale === "en" ? "Lonely Girl" : "孤独少女");
        if (!privateActor) {
          const terminal = buildReplaySnapshot(doc, doc.events.length - 1);
          expect(terminal.players.find((p) => p.playerId === view.player_id)).toMatchObject({
            role: "lonely_girl",
            camp: "good",
            alive: false,
            isWinner: true,
          });
        }
        expect(JSON.stringify(doc)).toBe(original);
      });
