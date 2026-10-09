import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readReplayDocument } from "@ai-werewolf-arena/replay-contract";
import { eventLabel } from "../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
import { createReplayRenderInput, buildReplayFrame } from "../../../src/replay/replay-frame";
import { ReplayFrame } from "../../../src/replay/ReplayComposition";

for (const locale of ["zh-CN", "en"] as const)
  for (const result of ["wolf", "not_wolf"] as const)
    test(`${locale}/${result}: duel kills exactly its loser and preserves non-wolf identity and pure frame output`, () => {
      const raw = {
        schemaVersion: 2,
        sessionId: "knight-display",
        perspective: "god",
        meta: {
          board: "knight_demo",
          locale,
          startedAt: "2026-10-08T00:00:00.000Z",
          endedAt: "2026-10-08T00:01:00.000Z",
        },
        result: { winner: null, reason: "in_progress" },
        players: [
          { player_id: 1, role: "knight", camp: "good" },
          {
            player_id: 2,
            role: result === "wolf" ? "wolf" : "unknown_future_role",
            camp: result === "wolf" ? "wolf" : "third_party",
          },
          { player_id: 3, role: "villager", camp: "good" },
        ],
        events: [
          {
            seq: 1,
            day: 1,
            phase: "day",
            timestamp: "2026-10-08T00:01:00.000Z",
            type: "knight_duel",
            payload: { actorId: 1, targetId: 2, result },
          },
        ],
      };
      const before = structuredClone(raw),
        replay = readReplayDocument(raw),
        snapshot = buildReplaySnapshot(replay, 0);
      expect(
        snapshot.players.filter((player) => !player.alive).map((player) => player.playerId),
      ).toEqual(result === "wolf" ? [2] : [1]);
      const expected =
        result === "wolf"
          ? locale === "en"
            ? "Knight 1 duels player 2; the wolf target dies"
            : "1号骑士决斗2号，目标为狼并出局"
          : locale === "en"
            ? "Knight 1 duels player 2; the non-wolf target survives and the Knight dies"
            : "1号骑士决斗2号，目标非狼存活，骑士出局";
      expect(eventLabel(replay.events[0], locale)).toBe(expected);
      const input = createReplayRenderInput(replay, { locale, timeZone: "UTC" });
      expect(buildReplayFrame(input, 10).label).toBe(expected);
      const markup = renderToStaticMarkup(<ReplayFrame input={input} frame={10} />);
      expect(markup).toContain(expected);
      expect(markup).toBe(renderToStaticMarkup(<ReplayFrame input={input} frame={10} />));
      expect(raw).toEqual(before);
      expect(
        eventLabel(
          { ...replay.events[0], payload: { actorId: 1, targetId: 2, result: "unknown" } },
          locale,
        ),
      ).toBe(locale === "en" ? "Unknown" : "未知");
    });
