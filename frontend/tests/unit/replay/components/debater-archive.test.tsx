/**
 * Unit component tests for debater archive replay display.
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
  for (const outcome of ["success", "tie"])
    for (const locale of ["zh-CN", "en"] as const)
      test(`${size}/${outcome}/${locale}: actual recorded flip keeps Debater alive and shared studio/video caption anonymous`, () => {
        const document = readReplayDocument(
            JSON.parse(
              readFileSync(
                new URL(`../../../fixtures/debater-${size}-${outcome}.replay.json`, import.meta.url),
                "utf8",
              ),
            ),
          ),
          before = JSON.stringify(document),
          index = document.events.findIndex((e) => e.type === "debater_revealed"),
          actor = document.events[index]!.payload.actorId,
          pre = buildReplaySnapshot(document, index - 1),
          post = buildReplaySnapshot(document, index);
        expect(pre.players.find((p) => p.playerId === actor)?.alive).toBe(true);
        expect(post.players.find((p) => p.playerId === actor)?.alive).toBe(true);
        expect(post.players.find((p) => p.playerId === actor)?.role).toBe("debater");
        const resultIndex = document.events.findIndex((e) => e.type === "debate_resolved"),
          result = document.events[resultIndex]!,
          input = createReplayRenderInput(document, { locale, timeZone: "UTC" }),
          frame = resultIndex * 90 + 15;
        expect(
          buildReplayFrame(input, frame).snapshot.players.find((p) => p.playerId === actor)?.alive,
        ).toBe(true);
        const label = eventLabel(
          result,
          locale,
          document.players.map((p) => p.player_id),
        );
        expect(label).not.toContain("voterId");
        expect(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />)).toContain(
          locale === "en" ? "Debater" : "杠精",
        );
        expect(JSON.stringify(document)).toBe(before);
      });
