/**
 * Unit tests verify wolf sorcerer fact acceptance, display labels.
 * Input: the original literal facts, malformed payloads and case tables with explicit display locale.
 * Output: the original fact acceptance, display labels assertions.
 * Handwritten field, label and effect expectations are the independent oracle.
 * Existing case tables remain unchanged; no live game executes or golden regenerates.
 */
import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
function event(type: string, payload: Record<string, unknown>, phase = "night"): ReplayEvent {
  return {
    seq: 1,
    timestamp: new Date(0).toISOString(),
    day: 2,
    phase,
    type,
    payload,
  } as ReplayEvent;
}
for (const locale of ["zh-CN", "en"] as const) {
  test("Wolf Sorcerer choices are descriptive and never swap public identities/" + locale, () => {
    for (const pair of [[2, 3], null]) {
      const e = event("wolf_sorcerer_exchange_committed", { actorId: 1, day: 2, pair });
      const f = readReplayEvent(e, [1, 2, 3])!;
      expect(f.effects).toEqual([]);
      expect(f.relatedPlayerIds).toEqual(pair ? [1, 2, 3] : [1]);
      expect(eventLabel(e, locale, [1, 2, 3])).not.toContain("event.");
    }
  });
  test("Wolf Sorcerer skips preserve public replay state/" + locale, () => {
    for (const reason of ["dead", "not_started", "exhausted"]) {
      const e = event("wolf_sorcerer_exchange_skipped", { actorId: 1, day: 2, reason });
      const f = readReplayEvent(e, [1, 2, 3])!;
      expect(f.effects).toEqual([]);
      expect(f.relatedPlayerIds).toEqual([1]);
      expect(eventLabel(e, locale, [1, 2, 3])).not.toContain("event.");
    }
  });
}
test("Wolf Sorcerer reader rejects malformed private choices", () => {
  for (const payload of [
    { actorId: 1, day: 1, pair: [2, 3] },
    { actorId: 1, day: 2, pair: [3, 2] },
    { actorId: 1, day: 2, pair: [2, 99] },
    { actorId: 1, day: 2, pair: [2, 2] },
    { actorId: 1, day: 2, pair: null, secret: "leak" },
  ])
    expect(
      readReplayEvent(event("wolf_sorcerer_exchange_committed", payload), [1, 2, 3]),
    ).toBeNull();
  expect(
    readReplayEvent(
      event("wolf_sorcerer_exchange_committed", { actorId: 1, day: 2, pair: [2, 3] }, "voting"),
      [1, 2, 3],
    ),
  ).toBeNull();
  for (const payload of [
    { actorId: 99, day: 2, reason: "dead" },
    { actorId: 1, day: 2, reason: "passed" },
    { actorId: 1, day: 2, reason: "dead", pair: [2, 3] },
  ])
    expect(readReplayEvent(event("wolf_sorcerer_exchange_skipped", payload), [1, 2, 3])).toBeNull();
});
