/**
 * Unit tests: Player gun projection uses native and copied origins plus unknown fields;
 * exact neutral viewer facts and detached payload assertions check identical public shot
 * semantics. Inputs and expected outcomes remain the original literal or immutable-fixture
 * oracle; these module assertions invoke no model or complete-game driver.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import type { GameEvent } from "../../../src/domain";
import { buildAgentVisibleEventFeed } from "../../../src/agents/observation/event-feed";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";

test("native and copied gun sources produce identical player facts for every viewer", () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig);
  const native: GameEvent = {
    timestamp: 1,
    type: "hunter_shot",
    payload: { hunterId: 3, targetId: 2 },
  };
  const copied: GameEvent = {
    timestamp: 9,
    type: "player_shot",
    payload: { actorId: 3, targetId: 2 },
  };
  for (const id of world.entityIds()) {
    const expected = [{ seq: 1, type: "player_shot", payload: { actorId: 3, targetId: 2 } }];
    expect(buildAgentVisibleEventFeed(world, [native], id)).toEqual(expected);
    expect(buildAgentVisibleEventFeed(world, [copied], id)).toEqual(expected);
  }
  expect(native).toEqual({
    timestamp: 1,
    type: "hunter_shot",
    payload: { hunterId: 3, targetId: 2 },
  });
});

test("gun projection excludes unknown private fields and detaches mutable payloads", () => {
  const { world } = bootstrapGame(sixPlayerMvpConfig);
  for (const type of ["hunter_shot", "player_shot"] as const) {
    const payload = {
      ...(type === "hunter_shot" ? { hunterId: 3 } : { actorId: 3 }),
      targetId: 2,
      trueRole: "PRIVATE_ROLE",
      learnedFrom: 5,
      stock: 1,
      internal: { owner: "PRIVATE_OWNER" },
    };
    const event = { timestamp: 1, type, payload } as GameEvent;
    const feed = buildAgentVisibleEventFeed(world, [event], 1);
    expect(feed).toEqual([{ seq: 1, type: "player_shot", payload: { actorId: 3, targetId: 2 } }]);
    feed[0].payload.targetId = 6;
    expect(payload.targetId).toBe(2);
    expect(payload.internal.owner).toBe("PRIVATE_OWNER");
  }
});
