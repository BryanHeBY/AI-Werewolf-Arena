/**
 * Unit component tests for wall archive replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import { eventLabel } from "../../../../src/replay/event-labels";
for (const size of [6, 12])
  for (const mode of ["write", "skip"])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${size}/${mode}/${locale}: actual wall archive public literal text and shared studio/video frame`, () => {
        const document = readReplayDocument(
            JSON.parse(
              readFileSync(
                new URL(`../../../fixtures/wall-${size}-${mode}.replay.json`, import.meta.url),
                "utf8",
              ),
            ),
          ),
          before = JSON.stringify(document),
          index = document.events.findIndex((e) => e.type === "wall_notes_published"),
          event = document.events[index];
        expect(index).toBeGreaterThan(0);
        expect(buildReplaySnapshot(document, index).players).toEqual(
          buildReplaySnapshot(document, index - 1).players,
        );
        const input = createReplayRenderInput(document, { locale, timeZone: "UTC" }),
          frame = input.replay.events.findIndex((e) => e.seq === event.seq) * 90 + 15;
        expect(buildReplayFrame(input, frame).snapshot.players).toEqual(
          buildReplaySnapshot(document, index).players,
        );
        const label = eventLabel(
          event,
          locale,
          document.players.map((p) => p.player_id),
        );
        expect(label).toContain(mode === "write" ? "[God] secret 💌" : "[]");
        expect(label).not.toContain("actorId");
        const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
        expect(markup).toContain(locale === "en" ? "Anonymous wall" : "匿名墙");
        expect(markup).not.toContain("undefined");
        expect(JSON.stringify(document)).toBe(before);
      });
