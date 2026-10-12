/**
 * Unit tests verify radiant eclipse fact acceptance, display labels.
 * Input: the original literal facts, malformed payloads and case tables with explicit display locale.
 * Output: the original fact acceptance, display labels assertions.
 * Handwritten field, label and effect expectations are the independent oracle.
 * Existing case tables remain unchanged; no live game executes or golden regenerates.
 */
import { expect, test } from "bun:test";
import { readRadiantEclipseFact } from "@ai-werewolf-arena/game-text";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../../src/replay/event-labels";
const facts = [
  [
    "eclipse_swallowed",
    { actorId: 10, day: 2, targetId: 7, roleId: "witch", abilityId: "copy:eclipse:night:2" },
    ["10 swallows 7's native skill.", "10吞噬7的原生技能。"],
  ],
  [
    "eclipse_swallowed",
    { actorId: 10, day: 2, targetId: null, roleId: null, abilityId: null },
    ["10 passes on swallowing this night.", "10本夜未吞噬技能。"],
  ],
  [
    "radiant_shelter_chosen",
    { actorId: 9, day: 2, targetId: 11, abilityId: "native:shelter" },
    ["9 shelters 11.", "9庇护11。"],
  ],
  [
    "radiant_shelter_chosen",
    { actorId: 9, day: 2, targetId: null, abilityId: "native:shelter" },
    ["9 passes on shelter this night.", "9本夜未使用流光庇护。"],
  ],
  [
    "eclipse_native_suppressed",
    { playerId: 7, day: 2 },
    [
      "Your native skill is temporarily suppressed for this night; it returns at dawn.",
      "你的原生技能本夜暂时失效；天亮恢复。",
    ],
  ],
  [
    "eclipse_native_restored",
    { playerId: 7, day: 2 },
    ["This night's temporary suppression has ended.", "本夜临时封禁已解除。"],
  ],
  [
    "eclipse_lease_closed",
    { actorId: 10, day: 2, targetId: 7, abilityId: "copy:eclipse:night:2", status: "committed" },
    ["Borrowed authorization closed normally for night 2.", "第2夜借用授权正常关闭。"],
  ],
  [
    "eclipse_lease_closed",
    { actorId: 10, day: 2, targetId: 7, abilityId: "copy:eclipse:night:2", status: "aborted" },
    ["Borrowed authorization closed after night 2 was aborted.", "第2夜借用授权因中止关闭。"],
  ],
] as const;
const envelope = (type: string, payload: Record<string, unknown>): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-10-12T00:00:00Z",
  day: 2,
  phase: "night",
  type,
  payload,
});
for (const [type, payload, labels] of facts)
  for (const locale of ["en", "zh-CN"] as const)
    test(`Radiant fact literal label and inert shape/${type}/${"targetId" in payload ? (payload.targetId ?? "none") : "owner"}/${locale}`, () => {
      const event = envelope(type, { ...payload });
      expect(readReplayEvent(event, [7, 9, 10, 11])?.effects).toEqual([]);
      expect(eventLabel(event, locale)).toBe(labels[locale === "en" ? 0 : 1]);
      if (type !== "eclipse_lease_closed" || payload.status !== "aborted")
        expect(readReplayEvent({ ...event, day: 3 })).toBeNull();
      if (type !== "eclipse_lease_closed" || payload.status !== "aborted")
        expect(readReplayEvent({ ...event, phase: "day" })).toBeNull();
      expect(readReplayEvent({ ...event, payload: { ...payload, extra: true } })).toBeNull();
      expect(readReplayEvent(event, [99])).toBeNull();
    });
test("aborted close preserves interruption phase while a normal close remains night-only", () => {
  const payload = {
    actorId: 10,
    day: 2,
    targetId: 7,
    abilityId: "copy:eclipse:night:2",
    status: "aborted",
  };
  expect(
    readReplayEvent({ ...envelope("eclipse_lease_closed", payload), phase: "voting" }),
  ).not.toBeNull();
  expect(
    readReplayEvent({
      ...envelope("eclipse_lease_closed", { ...payload, status: "committed" }),
      phase: "voting",
    }),
  ).toBeNull();
});
test("known malformed facts and foreign accessors are inert", () => {
  let calls = 0;
  const payload = Object.defineProperty({ playerId: 7, day: 2 }, "day", {
    enumerable: true,
    get() {
      calls++;
      return 2;
    },
  });
  expect(readRadiantEclipseFact("eclipse_native_suppressed", payload)).toBeNull();
  expect(calls).toBe(0);
  for (const bad of [
    { actorId: 10, day: 1, targetId: 7, roleId: "witch", abilityId: "copy:eclipse:night:1" },
    { actorId: 10, day: 2, targetId: 10, roleId: "witch", abilityId: "copy:eclipse:night:2" },
    { actorId: 10, day: 2, targetId: 7, roleId: "witch", abilityId: "native:potion" },
  ]) {
    const event = envelope("eclipse_swallowed", bad);
    expect(readReplayEvent(event)).toBeNull();
    expect(eventLabel(event, "en")).toBe("Unknown");
  }
});
