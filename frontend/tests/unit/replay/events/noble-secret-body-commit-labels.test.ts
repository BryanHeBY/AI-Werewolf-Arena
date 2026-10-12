/**
 * Unit tests verify noble secret body commit labels fact acceptance, display labels, event-prefix effects.
 * Input: the original literal facts, malformed payloads and case tables with explicit display locale.
 * Output: the original fact acceptance, display labels, event-prefix effects assertions.
 * Handwritten field, label and effect expectations are the independent oracle.
 * Existing case tables remain unchanged; no live game executes or golden regenerates.
 */
import { expect, test } from "bun:test";
import { nobleSecretBodyEventLabel } from "@ai-werewolf-arena/game-text";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
const policy = "awa_noble_secret_body_v1";
for (const f of [
  { type: "noble_body_knife_committed", payload: { policy, actorId: 1, day: 2, targetId: 6 } },
  { type: "noble_body_knife_committed", payload: { policy, actorId: 1, day: 2, targetId: null } },
  { type: "noble_body_native_damage_committed", payload: { policy, actorId: 5, day: 2 } },
])
  test(`God commit reader retains Alive and badge ${f.type}/${f.payload.targetId}`, () => {
    const e = {
      ...f,
      seq: 1,
      phase: "night",
      day: 2,
      stage: f.type,
      timestamp: "2026-10-12T00:00:00.000Z",
    } as any;
    expect(readReplayEvent(e, [1, 5, 6])?.effects).toEqual([]);
    for (const locale of ["zh-CN", "en"] as const)
      expect(eventLabel(e, locale, [1, 5, 6])).toBe(
        nobleSecretBodyEventLabel(f.type, f.payload, locale)!,
      );
    for (const phase of ["day", "voting", "game_over"])
      expect(readReplayEvent({ ...e, phase }, [1, 5, 6])).toBeNull();
    expect(readReplayEvent({ ...e, day: 3 }, [1, 5, 6])).toBeNull();
    expect(readReplayEvent({ ...e, payload: { ...f.payload, rawStock: 1 } }, [1, 5, 6])).toBeNull();
    const doc = {
      players: [1, 5, 6].map((player_id) => ({
        player_id,
        name: `Player ${player_id}`,
        role: "unknown",
        camp: "unknown",
      })),
      events: [e],
    };
    expect(
      buildReplaySnapshot(doc as any, 0).players.every(
        (p) => p.alive && !p.isSheriff && p.publicRole === undefined,
      ),
    ).toBe(true);
  });
