/**
 * Package unit contract for Debate literal ballot and result records.
 * Independently supplied counts, voter IDs and speech text check exact fields,
 * majority correlation and original null/boolean behavior. No tally engine,
 * debate window, speaker permission or production oracle supplies expectations.
 */
import { expect, test } from "bun:test";
import {
  DEBATE_EVENT_TYPES,
  readDebateEventFact,
} from "@ai-werewolf-arena/game-contract/facts/debate";
test("speech preserves raw/empty text and literal ballot null support", () => {
  expect(DEBATE_EVENT_TYPES).toHaveLength(6);
  expect<unknown>(
    readDebateEventFact("debate_speech", { actorId: Number.MAX_SAFE_INTEGER, text: "" }),
  ).toEqual({ actorId: Number.MAX_SAFE_INTEGER, text: "" });
  const row = {
    actorId: 1,
    targetId: 2,
    day: 1,
    eligibleCount: 2,
    ballots: [
      { voterId: 1, support: null },
      { voterId: 2, support: false },
    ],
  };
  expect<unknown>(readDebateEventFact("debate_ballots_recorded", row)).toEqual(row);
  expect(
    readDebateEventFact("debate_ballots_recorded", {
      ...row,
      ballots: [
        { voterId: 1, support: null },
        { voterId: 1, support: true },
      ],
    }),
  ).toBeNull();
});
test("resolved counts retain strict majority and blocked-ID correlation", () => {
  const row = {
    actorId: 1,
    targetId: 2,
    day: 1,
    eligibleCount: 4,
    supports: 2,
    rejects: 1,
    abstentions: 1,
    success: false,
    blockedId: 1,
  };
  expect<unknown>(readDebateEventFact("debate_resolved", row)).toEqual(row);
  for (const delta of [
    { success: true },
    { blockedId: 2 },
    { abstentions: 2 },
    { eligibleCount: 129 },
    { targetId: 1 },
  ])
    expect(readDebateEventFact("debate_resolved", { ...row, ...delta })).toBeNull();
});
test("cancellation reason and accessor failures do not admit extra fields", () => {
  expect(
    readDebateEventFact("debate_canceled", {
      actorId: 1,
      targetId: 2,
      day: 1,
      reason: "scope_changed",
    }),
  ).not.toBeNull();
  expect(
    readDebateEventFact("debate_canceled", { actorId: 1, targetId: 2, day: 1, reason: "timeout" }),
  ).toBeNull();
  let reads = 0;
  expect(
    readDebateEventFact("debate_speech", {
      actorId: 1,
      get text() {
        reads++;
        return "raw";
      },
    }),
  ).toBeNull();
  expect(reads).toBe(0);
});
