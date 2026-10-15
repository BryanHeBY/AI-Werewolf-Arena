/**
 * Unit test verifies Fragrant God trigger and malformed owner facts cannot become player events through forged audience.
 * Input: Original local world bootstrap and literal event envelopes with extra owner fields.
 * Output and oracle: Exact null/false visibility checks preserve the existing projection boundary; no cycle, transport or recording executes.
 */
import { expect, test } from "bun:test";
import { Phase } from "../../../../src/domain/identity";
import type { GameEvent } from "../../../../src/domain/events";
import { getDefaultAgentEventVisibilityRegistry } from "../../../../src/game/mechanisms";
import { buildAgentVisibleEvent } from "../../../../src/game/engine/agent_visible_event_feed";
import { fragrantRuntimeGame } from "../../../support/features/fragrant-pair-seer/builders/runtime-game";

test("God trigger cannot become an actor event by a forged audience, and owner fields reject extras", () => {
  const g = fragrantRuntimeGame();
  const god: GameEvent = {
    type: "fragrant_link_triggered",
    timestamp: 1,
    payload: {
      policy: "awa_fragrant_pair_seer_v1",
      actorId: 1,
      day: 1,
      bindingId: "fragrant:night:1",
      pairIds: [5, 6],
      rootId: 5,
      addedTargetId: 6,
      rootPhase: Phase.Night,
      initialWave: true,
    },
    audience: [1],
  };
  expect(buildAgentVisibleEvent(g.world, god, 1, 1)).toBeNull();
  expect(getDefaultAgentEventVisibilityRegistry().canView(g.world, god, 1)).toBe(false);
  const own = {
    type: "fragrant_pair_chosen",
    timestamp: 1,
    payload: {
      policy: "awa_fragrant_pair_seer_v1",
      actorId: 1,
      day: 1,
      pairIds: [5, 6],
      rootId: 5,
    },
    audience: [1],
  } as unknown as GameEvent;
  expect(buildAgentVisibleEvent(g.world, own, 1, 1)).toBeNull();
  expect(getDefaultAgentEventVisibilityRegistry().canView(g.world, own, 1)).toBe(false);
});
