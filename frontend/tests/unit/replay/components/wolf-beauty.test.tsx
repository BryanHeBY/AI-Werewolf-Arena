/**
 * Unit component tests for wolf beauty replay display.
 * Input: existing recorded or literal replay data, event cursors and explicit
 * language/frame settings; output: the original seat, timeline and rendered
 * frame assertions. Handwritten visibility/state expectations and immutable
 * archives are independent oracles. No live game or model transport executes.
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import {
  createReplayRenderInput,
  buildReplayFrame,
  FRAMES_PER_EVENT,
} from "../../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../../src/replay/ReplayComposition";
import blocked from "../../../fixtures/wolf-beauty-blocked.replay.json";
import lastGod from "../../../fixtures/wolf-beauty-last-god.replay.json";
for (const locale of ["zh-CN", "en"] as const)
  for (const special of [false, true])
    test(`${locale}/${special}: actual Beauty protection/last-god archive keeps actual lives and dead winner membership in the pure frame`, () => {
      const raw = structuredClone(special ? lastGod : blocked);
      raw.meta.locale = locale;
      const before = structuredClone(raw),
        replay = readReplayDocument(raw);
      const index = replay.events.findIndex(
          (event) => event.type === (special ? "additional_deaths" : "charm_blocked"),
        ),
        snapshot = buildReplaySnapshot(replay, index);
      expect(
        snapshot.players.filter((player) => !player.alive).map((player) => player.playerId),
      ).toEqual(special ? [1, 2, 3] : [1, 6]);
      expect(snapshot.players.find((player) => player.playerId === 5)!.alive).toBe(true);
      expect(snapshot.decision).toBeNull();
      const label = special
        ? locale === "en"
          ? "Additional deaths: Player 2"
          : "追加死亡：2号"
        : locale === "en"
          ? "Dream protection blocks Wolf Beauty 1's night charm death of player 5"
          : "1号对5号的夜间魅惑牵连被梦保护阻止";
      expect(eventLabel(replay.events[index], locale)).toBe(label);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" }),
        frame =
          input.replay.events.findIndex((event) => event.seq === replay.events[index].seq) *
            FRAMES_PER_EVENT +
          10;
      expect(buildReplayFrame(input, frame).label).toBe(label);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />);
      expect(markup).toContain(
        special
          ? label
          : locale === "en"
            ? "Dream protection blocks Wolf Beauty"
            : "夜间魅惑牵连被梦保护阻止",
      );
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={frame} />));
      const final = buildReplaySnapshot(replay, replay.events.length - 1),
        outcome = final.decision?.outcome;
      if (outcome?.kind !== "victory") throw new Error("wolf_beauty_fixture_victory_missing");
      expect(outcome.winningPlayerIds).toEqual(special ? [1] : [3, 4, 5, 6]);
      expect(final.players.find((player) => player.playerId === 1)!.alive).toBe(false);
      expect(raw).toEqual(before);
      const choice = replay.events.find((event) => event.type === "charm_applied")!,
        nullChoice = { ...choice, payload: { actorId: 1, targetId: null, day: 1 } };
      expect(eventLabel(nullChoice, locale)).toBe(
        locale === "en"
          ? "Wolf Beauty 1 chooses charm target None on night 1"
          : "1号狼美人本夜魅惑目标：无（第1夜）",
      );
      if (!special)
        expect(
          eventLabel(
            { ...replay.events[index], payload: { actorId: 1, targetId: 5, reason: "unknown" } },
            locale,
          ),
        ).toBe(locale === "en" ? "Unknown" : "未知");
    });
