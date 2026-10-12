/**
 * Unit component tests for cursed fox display replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { replayResultLabel } from "../../../../src/replay/replay-localization";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
for (const locale of ["zh-CN", "en"] as const)
  for (const kind of ["dream", "inspection", "king_chain"] as const)
    test(`${locale}/${kind}: actual Fox archive, studio seats and video frame share independent winners and translated goal`, () => {
      const document = readReplayDocument(
          JSON.parse(
            readFileSync(
              new URL(`../../../fixtures/fox-${kind}.replay.json`, import.meta.url),
              "utf8",
            ),
          ),
        ),
        before = JSON.stringify(document);
      const terminal = document.events.length - 1,
        early = buildReplaySnapshot(document, terminal - 1),
        final = buildReplaySnapshot(document, terminal);
      const winners = kind === "dream" ? [1] : [2, 4, 5, 6];
      expect(early.players.filter((p) => p.isWinner)).toEqual([]);
      expect(final.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual(winners);
      expect(final.players.find((p) => p.playerId === 1)!.alive).toBe(kind === "dream");
      const label = replayResultLabel(document, locale);
      if (kind === "dream") {
        expect(label).toContain(locale === "en" ? "personal goal victory" : "个人目标胜利");
        expect(label).toContain(
          locale === "en" ? "Survive an ordinary faction elimination" : "普通阵营全灭时存活",
        );
        expect(label).not.toContain("netease_cursed_fox_last_faction_v1");
      }
      const input = createReplayRenderInput(document, { locale, timeZone: "UTC" }),
        frame = buildReplayFrame(input, terminal * 90 + 15);
      expect(frame.snapshot.players.filter((p) => p.isWinner).map((p) => p.playerId)).toEqual(
        winners,
      );
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={terminal * 90 + 15} />);
      expect(markup).toContain(locale === "en" ? "Cursed Fox" : "咒狐");
      expect(markup).not.toContain("fox_inspection");
      expect(JSON.stringify(document)).toBe(before);
    });
