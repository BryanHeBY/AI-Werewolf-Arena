/**
 * Unit tests verify mist raven fact acceptance, display labels, event-prefix effects.
 * Input: the original literal facts, malformed payloads and case tables with explicit display locale.
 * Output: the original fact acceptance, display labels, event-prefix effects assertions.
 * Handwritten field, label and effect expectations are the independent oracle.
 * Existing case tables remain unchanged; no live game executes or golden regenerates.
 */
import { expect, test } from "bun:test";
import { readMistRavenFact } from "@ai-werewolf-arena/game-text";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
import { eventStageName } from "../../../../src/replay/replay-localization";
import { buildReplaySnapshot } from "../../../../src/replay/replay-projection";
const facts = [
  ["alchemist_mist_chosen", { actorId: 1, day: 2, targetIds: [3, 4, 5] }],
  ["alchemist_mist_skipped", { actorId: 1, day: 2, reason: "spent" }],
  ["alchemist_snake_chosen", { actorId: 1, day: 2, targetId: 3 }],
  ["raven_unsealed", { actorId: 2, day: 2, awakened: true, knownTeammateIds: [5] }],
  ["raven_knife_chosen", { actorId: 2, day: 2, targetId: 4 }],
  ["raven_knife_skipped", { actorId: 2, day: 2, reason: "sealed" }],
  ["mist_knife_drawn", { day: 2, candidates: [3, 4, 5], targetId: 5 }],
] as const;
const envelope = (type: string, payload: Record<string, unknown>): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-10-11T00:00:00Z",
  day: 2,
  phase: type === "alchemist_snake_chosen" ? "day" : "night",
  type,
  payload,
});
for (const [type, payload] of facts)
  for (const locale of ["zh-CN", "en"] as const)
    test(`Mist/Raven private fact ${type}/${locale} has no early death effect`, () => {
      const event = envelope(type, structuredClone(payload));
      const result = readReplayEvent(event, [1, 2, 3, 4, 5]);
      expect(result).not.toBeNull();
      expect(result!.effects).toEqual([]);
      expect(eventLabel(event, locale)).not.toContain(type);
      expect(eventStageName(event, locale)).not.toBe(type);
      if (locale === "en") expect(eventLabel(event, locale)).not.toMatch(/\p{Script=Han}/u);
      expect(readReplayEvent({ ...event, day: 3 })).toBeNull();
      expect(
        readReplayEvent({ ...event, phase: event.phase === "night" ? "day" : "night" }),
      ).toBeNull();
      expect(readReplayEvent({ ...event, payload: { ...payload, extra: true } })).toBeNull();
      expect(readReplayEvent(event, [99])).toBeNull();
    });
const invalid = [
  ["alchemist_mist_chosen", { actorId: 1, day: 2, targetIds: [3, 3, 4] }],
  ["alchemist_mist_chosen", { actorId: 1, day: 2, targetIds: [3, 4] }],
  ["alchemist_mist_chosen", { actorId: 1, day: 2, targetIds: [3, 4, 5, 6] }],
  ["raven_unsealed", { actorId: 2, day: 2, awakened: false, knownTeammateIds: [] }],
  ["raven_unsealed", { actorId: 2, day: 2, awakened: true, knownTeammateIds: [2] }],
  ["raven_unsealed", { actorId: 2, day: 2, awakened: true, knownTeammateIds: [3, 4] }],
  ["raven_knife_chosen", { actorId: 2, day: 2, targetId: 2 }],
  ["alchemist_mist_skipped", { actorId: 1, day: 2, reason: "sealed" }],
  ["alchemist_snake_chosen", { actorId: 1, day: 2, targetId: 1 }],
  ["mist_knife_drawn", { day: 2, candidates: [3, 4, 5], targetId: 6 }],
  ["mist_knife_drawn", { day: 2, candidates: [], targetId: 3 }],
  ["mist_knife_drawn", { day: 2, candidates: [3, 4, 5], targetId: null }],
] as const;
for (const [type, payload] of invalid)
  test(`invalid Mist/Raven fact is inert ${type}/${JSON.stringify(payload)}`, () => {
    expect(readMistRavenFact(type, payload)).toBeNull();
    expect(readReplayEvent(envelope(type, { ...payload }))).toBeNull();
    expect(eventLabel(envelope(type, { ...payload }), "en")).toBe("Unknown");
  });
test("empty mist circle only confirms an empty draw, never a death", () => {
  const result = readReplayEvent(
    envelope("mist_knife_drawn", { day: 2, candidates: [], targetId: null }),
  );
  expect(result?.effects).toEqual([]);
  expect(result?.relatedPlayerIds).toEqual([]);
});
test("only the first night permits a self-heal fact", () => {
  expect(readMistRavenFact("alchemist_snake_chosen", { actorId: 1, day: 1, targetId: 1 })).toEqual({
    actorId: 1,
    day: 1,
    targetId: 1,
  });
  expect(
    readMistRavenFact("alchemist_snake_chosen", { actorId: 1, day: 2, targetId: null }),
  ).not.toBeNull();
  expect(
    readMistRavenFact("alchemist_snake_chosen", { actorId: 1, day: 2, targetId: 3 }),
  ).not.toBeNull();
});
test("seeking across private knife/Snake facts never substitutes for a public death announcement", () => {
  const events = [
    envelope("raven_knife_chosen", { actorId: 2, day: 2, targetId: 4 }),
    envelope("alchemist_snake_chosen", { actorId: 1, day: 2, targetId: 4 }),
    envelope("night_resolved", { deaths: [4] }),
  ].map((event, index) => ({ ...event, seq: index + 1 }));
  const replay = {
    players: [1, 2, 3, 4, 5].map((player_id) => ({ player_id, role: "villager", camp: "good" })),
    events,
  };
  const alive = (index: number) =>
    buildReplaySnapshot(replay, index)
      .players.filter((p) => p.alive)
      .map((p) => p.playerId);
  expect(alive(0)).toEqual([1, 2, 3, 4, 5]);
  expect(alive(1)).toEqual([1, 2, 3, 4, 5]);
  expect(alive(2)).toEqual([1, 2, 3, 5]);
  expect(alive(1)).toEqual([1, 2, 3, 4, 5]);
});
test("readers detach targets and reject accessors without invoking them", () => {
  const payload = { actorId: 1, day: 2, targetIds: [3, 4, 5] };
  const fact = readMistRavenFact("alchemist_mist_chosen", payload)!;
  payload.targetIds[0] = 9;
  expect(fact).toEqual({ actorId: 1, day: 2, targetIds: [3, 4, 5] });
  let reads = 0;
  const getter = Object.defineProperty({ ...payload }, "targetIds", {
    enumerable: true,
    get() {
      reads++;
      return [3, 4, 5];
    },
  });
  expect(readMistRavenFact("alchemist_mist_chosen", getter)).toBeNull();
  expect(reads).toBe(0);
});
