import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReplayDocument, ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { readReplayEvent, replayEventPlayerIds } from "../../../src/replay/replay-event-reader";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
import { eventLabel } from "../../../src/replay/event-labels";
import { eventStageName } from "../../../src/replay/replay-localization";
import { PlayerSeats } from "../../../src/replay/PlayerSeats";
const event = (payload: Record<string, unknown>): ReplayEvent => ({
  seq: 2,
  day: 1,
  phase: "day",
  timestamp: "2026-10-09T00:00:00.000Z",
  type: "player_role_revealed",
  payload,
});
const replay = (fact: ReplayEvent): ReplayDocument => ({
  schemaVersion: 2,
  perspective: "god",
  sessionId: "reveal",
  meta: {
    board: "open",
    startedAt: "2026-10-09T00:00:00.000Z",
    endedAt: "2026-10-09T00:01:00.000Z",
  },
  result: { winner: null, reason: null },
  players: [
    { player_id: 1, role: "wolf", camp: "wolf" },
    { player_id: 2, role: "villager", camp: "good" },
  ],
  events: [{ ...event({ phase: "day" }), type: "phase_changed", seq: 1 }, fact],
});
for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: public role card appears only at actual reveal, with no camp or winner inference`, () => {
    const fact = event({ playerId: 2, role: "hunter" });
    const input = replay(fact),
      before = JSON.stringify(input);
    expect(replayEventPlayerIds(fact, [1, 2])).toEqual([2]);
    expect(eventLabel(fact, locale, [1, 2])).toBe(
      locale === "en" ? "Player 2 revealed their role card: Hunter" : "2号公开身份牌：猎人",
    );
    expect(eventStageName(fact, locale, [1, 2])).toBe(
      locale === "en" ? "Role card revealed" : "死亡翻牌",
    );
    expect(buildReplaySnapshot(input, 0).players[1]!.publicRole).toBeUndefined();
    const snapshot = buildReplaySnapshot(input, 1);
    expect(snapshot.players[1]).toMatchObject({
      publicRole: "hunter",
      alive: false,
      camp: "good",
      isWinner: false,
    });
    const html = renderToStaticMarkup(
      <PlayerSeats
        players={snapshot.players}
        locale={locale}
        focusedPlayerId={null}
        onToggleFocus={() => {}}
      />,
    );
    expect(html).toContain(locale === "en" ? "Revealed: Hunter" : "已翻牌：猎人");
    expect(JSON.stringify(input)).toBe(before);
  });
for (const payload of [
  { playerId: 2, role: "unknown" },
  { playerId: 99, role: "hunter" },
  { playerId: 2, role: "hunter", camp: "wolf" },
  { playerId: 2, role: "hunter", resources: { uses: 3 } },
  { playerId: 2 },
])
  test(`bad reveal ${JSON.stringify(payload)} is rejected atomically`, () => {
    const fact = event(payload);
    expect(readReplayEvent(fact, [1, 2])).toBeNull();
    expect(replayEventPlayerIds(fact, [1, 2])).toEqual([]);
    expect(buildReplaySnapshot(replay(fact), 1).players[1]).toMatchObject({
      alive: true,
      camp: "good",
    });
    expect(buildReplaySnapshot(replay(fact), 1).players[1]!.publicRole).toBeUndefined();
    for (const locale of ["zh-CN", "en"] as const)
      expect(eventLabel(fact, locale, [1, 2])).toBe(text(locale, "replay.unknown"));
  });
test("accessor reveal roles are never evaluated", () => {
  let reads = 0;
  const payload = { playerId: 2 };
  Object.defineProperty(payload, "role", {
    enumerable: true,
    get() {
      reads++;
      return "hunter";
    },
  });
  expect(readReplayEvent(event(payload), [1, 2])).toBeNull();
  expect(reads).toBe(0);
});
