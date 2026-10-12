/**
 * Unit tests verify demon hunter fact acceptance, display labels, event-prefix effects.
 * Input: the original literal facts, malformed payloads and case tables with explicit display locale.
 * Output: the original fact acceptance, display labels, event-prefix effects assertions.
 * Handwritten field, label and effect expectations are the independent oracle.
 * Existing case tables remain unchanged; no live game executes or golden regenerates.
 */
import { expect, test } from "bun:test";
import { DEMON_HUNTER_POLICY, demonHunterEventLabel } from "@ai-werewolf-arena/game-text";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
const chosen = { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 2, targetId: 1 },
  own = { policy: DEMON_HUNTER_POLICY, day: 2, targetId: 1 };
function event(
  type: string,
  payload: Record<string, unknown>,
  day = Number(payload.day),
): ReplayEvent {
  return { seq: 1, timestamp: new Date(0).toISOString(), day, phase: "night", type, payload };
}
for (const [type, p, related] of [
  ["demon_hunter_chosen", chosen, [6, 1]],
  ["demon_hunter_chosen", { ...chosen, targetId: null }, [6]],
  ["demon_hunter_chosen", own, [1]],
  ["demon_hunter_chosen", { ...own, targetId: null }, []],
  ["demon_hunter_cancelled", { ...chosen, reason: "authority_revoked", faultId: null }, [6, 1]],
  [
    "demon_hunter_poison_immune",
    { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 1, witchId: 5 },
    [6, 5],
  ],
] as const)
  test(`strict frontend God/own fact ${type}/${JSON.stringify(p)}`, () => {
    const raw = event(type, p);
    expect(readReplayEvent(raw, [1, 2, 3, 4, 5, 6])?.relatedPlayerIds).toEqual(
      [...related].sort((a, b) => a - b),
    );
    expect(readReplayEvent(raw)?.effects).toEqual([]);
    for (const locale of ["zh-CN", "en"] as const)
      expect(eventLabel(raw, locale)).toBe(demonHunterEventLabel(type, p, locale)!);
    expect(readReplayEvent({ ...raw, day: raw.day + 1 })).toBeNull();
    expect(readReplayEvent({ ...raw, phase: "day" })).toBeNull();
    for (const extra of ["camp", "immune", "casterId", "winner", "damage"])
      expect(readReplayEvent(event(type, { ...p, [extra]: "wolf" }))).toBeNull();
  });
test("known malformed, absent members and accessors have no partial association or Alive effects", () => {
  for (const p of [
    { ...chosen, actorId: 99 },
    { ...chosen, targetId: 99 },
    { ...chosen, targetId: 6 },
    { ...chosen, day: 1 },
    { ...chosen, targetId: "1" },
  ])
    expect(readReplayEvent(event("demon_hunter_chosen", p), [1, 2, 3, 4, 5, 6])).toBeNull();
  let reads = 0;
  const bad = Object.defineProperty({ ...chosen }, "targetId", {
    get() {
      reads++;
      return 1;
    },
    enumerable: true,
  });
  expect(readReplayEvent(event("demon_hunter_chosen", bad))).toBeNull();
  expect(reads).toBe(0);
  const snapshot = buildReplaySnapshot(
    {
      players: [1, 2, 3, 4, 5, 6].map((id) => ({
        player_id: id,
        role: id === 6 ? "demon_hunter" : "wolf",
        camp: id === 6 ? "good" : "wolf",
      })),
      events: [
        event("demon_hunter_cancelled", { ...chosen, reason: "authority_revoked", faultId: null }),
      ],
    },
    0,
  );
  expect(snapshot.players.every((player) => player.alive)).toBe(true);
  expect(snapshot.decision).toBeNull();
});
