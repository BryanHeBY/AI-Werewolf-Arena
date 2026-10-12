/**
 * Unit tests verify Demon Hunter exact God/player fact fields and fail-closed audience/getter projections.
 * Input: Original literal full/own envelopes, field alterations and bounded fixture world for projection only.
 * Output and oracle: Exact accepted data, null rejected facts, safe labels and zero getter reads remain unchanged; no full night or file recorder runs.
 */
import { expect, test } from "bun:test";
import { DEMON_HUNTER_POLICY, readDemonHunterEventFact, readDemonHunterPlayerFact, demonHunterEventLabel } from "@ai-werewolf-arena/game-text";
import { type GameEvent } from "../../../../src/core";
import { demonHunterFixture } from "../../../support/demon_hunter_scenarios";
import { buildAgentVisibleEventFeed } from "../../../../src/game/engine/agent_visible_event_feed";

const chosen = { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 2, targetId: 1 },
  own = { policy: DEMON_HUNTER_POLICY, day: 2, targetId: 1 };

for (const [type, full] of [
  ["demon_hunter_chosen", chosen],
  ["demon_hunter_chosen", { ...chosen, targetId: null }],
  ["demon_hunter_cancelled", { ...chosen, reason: "authority_revoked", faultId: null }],
  ["demon_hunter_cancelled", { ...chosen, reason: "authority_revoked", faultId: "actual-fault-1" }],
  ["demon_hunter_poison_immune", { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 1, witchId: 5 }],
] as const)
  test(`strict God fact ${type}/${JSON.stringify(full)}`, () => {
    expect(readDemonHunterEventFact(type, full)).toEqual(full);
    expect(readDemonHunterPlayerFact(type, full)).toBeNull();
    for (const locale of ["zh-CN", "en"] as const)
      expect(demonHunterEventLabel(type, full, locale)).not.toBeNull();
    for (const field of ["camp", "role", "immune", "casterId", "remaining", "damage", "winner"]) {
      expect(readDemonHunterEventFact(type, { ...full, [field]: "wolf" })).toBeNull();
      expect(demonHunterEventLabel(type, { ...full, [field]: "wolf" }, "en")).toBeNull();
    }
  });

test("own choice exact fields, no actor/source/outcome and malformed getters execute zero", () => {
  expect(readDemonHunterPlayerFact("demon_hunter_chosen", own)).toEqual(own);
  expect(readDemonHunterEventFact("demon_hunter_chosen", own)).toBeNull();
  for (const field of ["actorId", "witchId", "faultId", "reason", "camp", "immune"])
    expect(readDemonHunterPlayerFact("demon_hunter_chosen", { ...own, [field]: 6 })).toBeNull();
  let reads = 0;
  const malformed = Object.defineProperty({ ...chosen }, "targetId", {
    get() {
      reads++;
      return 1;
    },
    enumerable: true,
  });
  expect(readDemonHunterEventFact("demon_hunter_chosen", malformed)).toBeNull();
  expect(demonHunterEventLabel("demon_hunter_chosen", malformed, "en")).toBeNull();
  expect(reads).toBe(0);
});

test("forged audience never exposes cancellation/immunity; copied or malformed choice fails closed", () => {
  const f = demonHunterFixture();
  const facts: GameEvent[] = [
    {
      timestamp: 0,
      type: "demon_hunter_chosen",
      payload: { ...chosen, actorId: 5 },
      audience: [5],
    },
    {
      timestamp: 1,
      type: "demon_hunter_cancelled",
      payload: { ...chosen, targetId: 1, reason: "authority_revoked", faultId: null },
      audience: [6],
    },
    {
      timestamp: 2,
      type: "demon_hunter_poison_immune",
      payload: { policy: DEMON_HUNTER_POLICY, actorId: 6, day: 1, witchId: 5 },
      audience: [6],
    },
    { timestamp: 3, type: "demon_hunter_chosen", payload: chosen, audience: [5] },
    { timestamp: 4, type: "demon_hunter_chosen", payload: chosen, audience: [5, 6] },
    {
      timestamp: 5,
      type: "demon_hunter_chosen",
      payload: { ...chosen, camp: "wolf" } as any,
      audience: [6],
    },
  ];
  for (const id of f.world.entityIds())
    expect(buildAgentVisibleEventFeed(f.world, facts, id)).toEqual([]);
});
