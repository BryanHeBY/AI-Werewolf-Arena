/**
 * Unit tests verify ghost bride fact acceptance, display labels.
 * Input: the original literal facts, malformed payloads and case tables with explicit display locale.
 * Output: the original fact acceptance, display labels assertions.
 * Handwritten field, label and effect expectations are the independent oracle.
 * Existing case tables remain unchanged; no live game executes or golden regenerates.
 */
import { expect, test } from "bun:test";
import { readReplayEvent } from "../../../../src/replay/replay-event-reader";
import { ghostBrideEventLabel, GHOST_BRIDE_POLICY } from "@ai-werewolf-arena/game-text";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
const base = { policy: GHOST_BRIDE_POLICY, groupId: "ghost-bride:1:1", day: 1 };
const facts: Array<[string, Record<string, unknown>]> = [
  ["ghost_bride_pair_chosen", { ...base, brideId: 1, groomId: 2 }],
  ["ghost_bride_group_chosen", { ...base, brideId: 1, groomId: 2, witnessId: 3 }],
  ["ghost_bride_witness_vote", { ...base, actorId: 1, targetId: 3, voteIndex: 1 }],
  ["ghost_bride_partner_chat", { ...base, actorId: 1, recipientId: 2, text: "" }],
  ["ghost_bride_knife_captured", { ...base, owner: "pair", actorIds: [1, 2] }],
  ["ghost_bride_knife_vote", { ...base, owner: "pair", actorId: 1, targetId: 3, abstain: false }],
  ["ghost_bride_knife_resolved", { ...base, owner: "pair", actorIds: [1, 2], targetId: null }],
  ["ghost_bride_partner_death", { ...base, actorId: 1, targetId: 2, phase: "night" }],
];
for (const [type, payload] of facts)
  test(`${type}: strict pure wedding fact links authorized references with zero identity/life/badge effects`, () => {
    const event: ReplayEvent = {
      seq: 1,
      timestamp: "2026-10-10T00:00:00Z",
      phase: "night",
      day: 1,
      type,
      payload,
    };
    expect(readReplayEvent(event, [1, 2, 3])).toMatchObject({ effects: [] });
    expect(
      readReplayEvent({ ...event, payload: { ...payload, extra: true } }, [1, 2, 3]),
    ).toBeNull();
    expect(readReplayEvent({ ...event, day: 2 }, [1, 2, 3])).toBeNull();
    expect(readReplayEvent({ ...event, phase: "day" }, [1, 2, 3])).toBeNull();
    expect(
      readReplayEvent({ ...event, payload: { ...payload, policy: "wrong" } }, [1, 2, 3]),
    ).toBeNull();
    const key = "actorId" in payload ? "actorId" : "brideId" in payload ? "brideId" : "actorIds";
    expect(
      readReplayEvent(
        { ...event, payload: { ...payload, [key]: key === "actorIds" ? [99] : 99 } },
        [1, 2, 3],
      ),
    ).toBeNull();
    let reads = 0;
    const getter = Object.defineProperty({ ...payload }, key, {
      enumerable: true,
      get() {
        reads++;
        return payload[key];
      },
    });
    expect(readReplayEvent({ ...event, payload: getter }, [1, 2, 3])).toBeNull();
    expect(reads).toBe(0);
    for (const locale of ["zh-CN", "en"] as const) {
      const label = ghostBrideEventLabel(type, payload, locale);
      expect(label).not.toBeNull();
      expect(label).not.toContain("undefined");
    }
  });
