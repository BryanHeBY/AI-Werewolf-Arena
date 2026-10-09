import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { readReplayDocument, type ReplayDocument, type ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { text } from "@ai-werewolf-arena/game-text";
import { readReplayEvent, replayEventPlayerIds, KNOWN_REPLAY_EVENT_TYPES } from "../../../src/replay/replay-event-reader";
import { eventLabel } from "../../../src/replay/event-labels";
import { buildReplaySnapshot } from "../../../src/replay/replay-projection";
import { replayResultLabel } from "../../../src/replay/replay-localization";

const event = (type: string, payload: Record<string, unknown>): ReplayEvent => ({ seq: 2, day: 1, phase: "day", timestamp: "t2", type, payload });
const replay = (fact: ReplayEvent): ReplayDocument => ({
  schemaVersion: 2, perspective: "god", sessionId: "reader", meta: { board: "offline", startedAt: "t1", endedAt: "t2" },
  result: { winner: null, reason: null }, players: [1, 2, 3].map(player_id => ({ player_id, role: "villager", camp: "good" })),
  events: [{ ...event("sheriff_elected", { winnerId: 1 }), seq: 1 }, fact],
});

test("all archived known events remain readable through the common fact reader", () => {
  const fixtures = new URL("../../fixtures/", import.meta.url);
  const rejected: string[] = [];
  let count = 0;
  for (const name of readdirSync(fixtures).filter(name => name.endsWith(".json"))) {
    const raw = readReplayDocument(JSON.parse(readFileSync(new URL(name, fixtures), "utf8")));
    const ids = raw.players.map(player => player.player_id);
    for (const fact of raw.events) {
      count++;
      if (KNOWN_REPLAY_EVENT_TYPES.includes(fact.type) && !readReplayEvent(fact, ids)) rejected.push(`${name}:${fact.seq}:${fact.type}`);
    }
  }
  expect(count).toBeGreaterThan(1000);
  expect(rejected).toEqual([]);
});

const malformed = [
  event("sheriff_elected", {}), event("sheriff_elected", { winnerId: null }), event("sheriff_elected", { winnerId: 99 }),
  event("sheriff_badge_transferred", { fromId: 1 }), event("sheriff_badge_transferred", { fromId: 1, toId: 99 }),
  event("sheriff_badge_destroyed", { targetId: 1.1 }),
  event("white_wolf_king_self_destruct", { actorId: 2 }), event("white_wolf_king_self_destruct", { actorId: 2, targetId: 99 }),
  event("hunter_shot", { targetId: 2 }), event("mechanical_shot", { actorId: 0, targetId: 2 }),
  event("night_resolved", { deaths: [2, "3"] }), event("additional_deaths", { deaths: [2, -3] }),
  event("knight_duel", { actorId: 2, targetId: 3, result: "future" }), event("dream_death", { actorId: 2, targetId: 3, reason: "future" }),
  event("vote_summary", { votes: [{ actorId: 1, targetId: 2 }, { actorId: 2, targetId: 99 }] }),
  event("mechanical_guard_chosen", { actorId: 2, targetId: 3, day: 1, failed: "false" }),
  event("black_market_trade_committed", { actorId: 2, targetId: 3, day: 1, skill: "future" }),
];
for (const [index, fact] of malformed.entries()) test(`malformed known fact ${index}/${fact.type} has no partial label, associations, death or badge effects`, () => {
  const input = replay(fact);
  const before = JSON.stringify(input);
  expect(readReplayDocument(input).events[1]).toEqual(fact); // Archive loading remains permissive.
  expect(readReplayEvent(fact, [1, 2, 3])).toBeNull();
  expect(replayEventPlayerIds(fact, [1, 2, 3])).toEqual([]);
  for (const locale of ["zh-CN", "en"] as const) expect(eventLabel(fact, locale, [1, 2, 3])).toBe(text(locale, "replay.unknown"));
  const snapshot = buildReplaySnapshot(input, 1);
  expect(snapshot.players.map(player => player.alive)).toEqual([true, true, true]);
  expect(snapshot.players.filter(player => player.isSheriff).map(player => player.playerId)).toEqual([1]);
  expect(JSON.stringify(input)).toBe(before);
});

test("nested votes, victory membership, gift source and reflected poison use explicit player references", () => {
  expect(replayEventPlayerIds(event("vote_summary", { votes: [{ actorId: 1, targetId: 2 }, { actorId: 3, abstain: true }], diagnostic: [99] }))).toEqual([1, 2, 3]);
  expect(replayEventPlayerIds(event("mechanical_poison_reflected", { actorId: 1, protectedTargetId: 2, casterId: 3, day: 1 }))).toEqual([1, 2, 3]);
  expect(replayEventPlayerIds(event("ability_changed", { actorId: 2, abilityId: "gift:x", kind: "future", operation: "future", source: { kind: "gift", actorId: 1 }, numbers: [3] }))).toEqual([1, 2]);
  const terminal = event("game_over", { winner: "good", reason: "all_wolves_eliminated", outcome: { kind: "victory", primary: { kind: "faction", faction: "good", winningPlayerIds: [1, 3] }, additional: [], winningPlayerIds: [1, 3] }, decidedAt: { day: 1, phase: "day", checkpoint: "night_settled" } });
  expect(replayEventPlayerIds(terminal)).toEqual([1, 3]);
});

test("future events retain safe prose but never infer effects or membership from arbitrary numbers", () => {
  const future = event("future_event", { text: "原文 <raw> prose", actorId: 2, targetId: 3, numbers: [1, 2] });
  expect(eventLabel(future, "en")).toBe("原文 <raw> prose");
  expect(replayEventPlayerIds(future)).toEqual([]);
  expect(readReplayEvent(future)?.effects).toEqual([]);
});

test("getters, cycles, invalid array items and traps fail without evaluating payload accessors", () => {
  let reads = 0;
  const hostile = event("white_wolf_king_self_destruct", { actorId: 2 });
  Object.defineProperty(hostile.payload, "targetId", { enumerable: true, get() { reads++; return 3; } });
  expect(eventLabel(hostile, "en")).toBe("Unknown");
  expect(buildReplaySnapshot(replay(hostile), 1).players.every(player => player.alive)).toBe(true);
  expect(replayEventPlayerIds(hostile)).toEqual([]);
  expect(reads).toBe(0);
  const nested = event("vote_summary", { votes: [{ actorId: 1 }] });
  Object.defineProperty((nested.payload.votes as object[])[0]!, "targetId", { enumerable: true, get() { reads++; return 2; } });
  expect(readReplayEvent(nested)).toBeNull(); expect(reads).toBe(0);
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  expect(readReplayEvent(event("future_event", cyclic))).toBeNull();
  expect(readReplayEvent(event("night_resolved", { deaths: new Array(2) }))).toBeNull();
  expect(readReplayEvent(event("night_resolved", new Proxy({}, { ownKeys() { throw new Error("trap"); } })))).toBeNull();
  expect(replayResultLabel(replay(event("phase_changed", { phase: 42 })), "en")).toBe("Unfinished");
});
