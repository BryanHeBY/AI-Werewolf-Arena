/**
 * Unit component tests for shapeshifter archive replay display.
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
for (const name of ["6-seer", "6-hunter", "12-both0", "12-one1"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual Shapeshifter archive starts in original identity and only changes at private fact, shared video frame`, () => {
      const doc = readReplayDocument(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(`frontend/tests/fixtures/shapeshifter-${name}.replay.json`),
              "utf8",
            ),
          ),
        ),
        original = JSON.stringify(doc),
        index = doc.events.findIndex((e) => e.type === "shapeshifter_identity_chosen"),
        fact = doc.events[index]!,
        actor = fact.payload.actorId as number;
      const before = buildReplaySnapshot(doc, index - 1),
        after = buildReplaySnapshot(doc, index),
        old = before.players.find((p) => p.playerId === actor)!,
        current = after.players.find((p) => p.playerId === actor)!;
      expect(old).toMatchObject({
        role: "shapeshifter",
        camp: "good",
        alive: true,
        isSheriff: false,
      });
      expect(current.role).toBe(fact.payload.role as string);
      expect(current.camp).toBe(fact.payload.camp as string);
      expect(after.players.map((p) => [p.playerId, p.alive, p.isSheriff, p.publicRole])).toEqual(
        before.players.map((p) => [p.playerId, p.alive, p.isSheriff, p.publicRole]),
      );
      const input = createReplayRenderInput(doc, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === fact.seq) * 90 + 15;
      expect(buildReplayFrame(input, frame).snapshot.players).toEqual(after.players);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(roleName(fact.payload.role as "wolf", locale));
      expect(markup).not.toContain("undefined");
      expect(
        eventLabel(
          fact,
          locale,
          doc.players.map((p) => p.player_id),
        ),
      ).toContain(locale === "en" ? "Many-Faced One" : "千面人");
      expect(JSON.stringify(doc)).toBe(original);
    });

for (const name of ["6-seer", "6-hunter", "12-both0", "12-one1"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual actor archive retains authorized choice after native role change, shared frame has unknown other identities`, () => {
      const view = readReplayPlayerView(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(`frontend/tests/fixtures/player-views/shapeshifter-${name}.player.json`),
              "utf8",
            ),
          ),
        ),
        god = readReplayDocument(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(`frontend/tests/fixtures/shapeshifter-${name}.replay.json`),
              "utf8",
            ),
          ),
        );
      const own = view.timeline.filter(
        (row) => row.kind === "event" && row.event.type === "shapeshifter_identity_chosen",
      );
      expect(own).toHaveLength(1);
      expect(
        view.timeline.some(
          (row) => row.kind === "event" && row.event.type === "shapeshifter_initial_deal",
        ),
      ).toBe(false);
      const row = own[0]!;
      if (row.kind !== "event") throw new Error("actual_choice_missing");
      expect(row.event.payload.actorId).toBe(view.player_id);
      expect(view.role).toBe("shapeshifter");
      const doc = readReplayDocument({
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
      });
      const before = buildReplaySnapshot(doc, 0),
        after = buildReplaySnapshot(doc, 1);
      expect(before.players.find((p) => p.playerId === view.player_id)?.role).toBe("shapeshifter");
      expect(after.players.find((p) => p.playerId === view.player_id)?.role).toBe(
        row.event.payload.role as string,
      );
      expect(
        after.players
          .filter((p) => p.playerId !== view.player_id)
          .every((p) => p.role === "unknown"),
      ).toBe(true);
      const input = createReplayRenderInput(doc, { locale, timeZone: "UTC" }),
        frame = buildReplayFrame(input, 105),
        markup = renderToStaticMarkup(<ReplayFrame input={input} frame={105} />);
      expect(frame.snapshot.players).toEqual(after.players);
      expect(markup).toContain(roleName(row.event.payload.role as "wolf", locale));
      expect(
        eventLabel(
          doc.events[1]!,
          locale,
          doc.players.map((p) => p.player_id),
        ),
      ).toContain(locale === "en" ? "Many-Faced One" : "千面人");
    });
