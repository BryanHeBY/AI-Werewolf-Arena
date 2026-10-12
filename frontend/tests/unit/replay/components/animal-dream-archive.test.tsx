/**
 * Unit component tests for animal dream archive replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { animalNames, loadAnimal, animalPrivateReplay } from "../../../support/animal-replay";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { eventLabel } from "../../../../src/replay/event-labels";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
for (const name of animalNames)
  for (const skip of ["wait", "skip"])
    for (const ballot of ["first", "final"])
      for (const locale of ["zh-CN", "en"] as const) {
        const fixture = `animal-${name}-${skip}-${ballot}-${locale}`;
        test(`Animal actual archive public death boundaries and reverse seeks ${fixture}`, () => {
          const replay = readReplayDocument(loadAnimal(fixture, ".replay.json")),
            input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
            ids = replay.players.map((p) => p.player_id);
          for (const [i, e] of replay.events.entries())
            if (
              e.type.startsWith("animal_") ||
              ["night_resolved", "additional_deaths", "voted_out", "game_over"].includes(e.type)
            ) {
              const fact = readReplayEvent(e, ids);
              expect(fact).not.toBeNull();
              const before = buildReplaySnapshot(replay, i - 1),
                after = buildReplaySnapshot(replay, i);
              if (e.type.startsWith("animal_")) {
                expect(after.players.map((p) => [p.playerId, p.alive, p.isSheriff])).toEqual(
                  before.players.map((p) => [p.playerId, p.alive, p.isSheriff]),
                );
                if (!e.type.endsWith("_revealed")) expect(fact!.effects).toEqual([]);
              }
              const j = input.replay.events.findIndex((p) => p.seq === e.seq);
              for (const offset of [0, 45, 89])
                expect(buildReplayFrame(input, j * 90 + offset).snapshot).toEqual(after);
              if (j > 0)
                expect(buildReplayFrame(input, j * 90 - 1).snapshot.players).toEqual(
                  before.players,
                );
              expect(eventLabel(e, locale, ids)).not.toMatch(/undefined|NaN/);
              if (locale === "en")
                expect(eventLabel(e, locale, ids)).not.toMatch(/\p{Script=Han}/u);
            }
          const final = buildReplayFrame(input, (input.replay.events.length - 1) * 90 + 89);
          expect(final.snapshot.decision?.outcome.kind).toBe("victory");
          expect(renderToStaticMarkup(<ReplayFrame input={input} frame={0} />)).not.toMatch(
            /undefined|NaN/,
          );
        });
        for (const owner of ["fox", "cat", "puffer", "villager"])
          test(`Animal actual authorized private archive ${fixture}/${owner}`, () => {
            const replay = animalPrivateReplay(fixture, owner),
              input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
              self = replay.players.find((p) => p.role !== "unknown")!.player_id;
            for (const [i, e] of input.replay.events.entries())
              if (e.type.startsWith("animal_")) {
                expect([
                  "animal_cat_revealed",
                  "animal_puffer_revealed",
                  "animal_fox_chosen",
                  "animal_knife_notified",
                  "animal_beauty_notified",
                  "animal_puffer_decided",
                ]).toContain(e.type);
                if (!e.type.endsWith("_revealed")) expect(e.payload.actorId).toBe(self);
                const frame = buildReplayFrame(input, i * 90 + 45);
                for (const p of frame.players)
                  if (p.playerId !== self && !p.publicRole) expect(p.role).toBe("unknown");
              }
          });
      }
