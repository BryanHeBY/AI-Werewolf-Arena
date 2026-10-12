/**
 * Unit component tests for thief archive replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { roleName } from "@ai-werewolf-arena/game-text";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { eventLabel } from "../../../../src/replay/event-labels";
for (const name of ["6-seer", "6-hunter", "12-both0", "12-keep"])
  for (const locale of ["zh-CN", "en"] as const)
    test(`${name}/${locale}: actual Thief archive starts in original identity and only changes at private fact, shared video frame`, () => {
      const doc = readReplayDocument(
          JSON.parse(
            readFileSync(
              new URL(`../../../fixtures/thief-${name}.replay.json`, import.meta.url),
              "utf8",
            ),
          ),
        ),
        original = JSON.stringify(doc),
        index = doc.events.findIndex((e) => e.type === "thief_identity_chosen"),
        fact = doc.events[index]!,
        actor = fact.payload.actorId as number;
      const before = buildReplaySnapshot(doc, index - 1),
        after = buildReplaySnapshot(doc, index),
        old = before.players.find((p) => p.playerId === actor)!,
        current = after.players.find((p) => p.playerId === actor)!;
      expect(old).toMatchObject({ role: "thief", camp: "good", alive: true, isSheriff: false });
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
      ).toContain(locale === "en" ? "Thief" : "盗贼");
      expect(JSON.stringify(doc)).toBe(original);
    });
