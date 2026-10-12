/**
 * Unit component tests for wild child archive replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { frontendFixtureURL } from "../../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { eventLabel } from "../../../../src/replay/event-labels";
for (const name of ["6-wolf_exile", "6-hunter_chain", "12-good_knife", "6-same_wave"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual Wild Child original Good archive and timed camp change, shared video frame`, () => {
      const doc = readReplayDocument(
          JSON.parse(
            readFileSync(
              frontendFixtureURL(`frontend/tests/fixtures/wild-child-${name}.replay.json`),
              "utf8",
            ),
          ),
        ),
        original = JSON.stringify(doc),
        choice = doc.events.find((e) => e.type === "wild_child_model_chosen")!,
        actor = choice.payload.actorId as number;
      expect(doc.players.find((p) => p.player_id === actor)).toMatchObject({
        role: "wild_child",
        camp: "good",
      });
      const index = doc.events.findIndex((e) => e.type === "wild_child_transformed");
      if (index < 0) {
        expect(
          buildReplaySnapshot(doc, doc.events.length - 1).players.find((p) => p.playerId === actor)
            ?.camp,
        ).toBe("good");
        expect(doc.events.some((e) => e.type === "wild_child_pack_activated")).toBe(false);
        return;
      }
      const fact = doc.events[index]!,
        before = buildReplaySnapshot(doc, index - 1),
        after = buildReplaySnapshot(doc, index);
      expect(before.players.find((p) => p.playerId === actor)).toMatchObject({
        role: "wild_child",
        camp: "good",
        alive: true,
      });
      expect(after.players.find((p) => p.playerId === actor)).toMatchObject({
        role: "wild_child",
        camp: "wolf",
        alive: true,
      });
      expect(
        after.players.map((p) => [p.playerId, p.role, p.alive, p.isSheriff, p.publicRole]),
      ).toEqual(
        before.players.map((p) => [p.playerId, p.role, p.alive, p.isSheriff, p.publicRole]),
      );
      const input = createReplayRenderInput(doc, { locale, timeZone: "UTC" }),
        frame = input.replay.events.findIndex((e) => e.seq === fact.seq) * 90 + 15;
      expect(buildReplayFrame(input, frame).snapshot.players).toEqual(after.players);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(locale === "en" ? "Wild Child" : "野孩子");
      expect(markup).not.toContain("undefined");
      expect(
        eventLabel(
          fact,
          locale,
          doc.players.map((p) => p.player_id),
        ),
      ).toContain(locale === "en" ? "Wild Child" : "野孩子");
      expect(JSON.stringify(doc)).toBe(original);
    });
