import { expect, test } from "bun:test";
import { redMoonCandidateWorld } from "../../support/features/red-moon/builders/candidate-world";
import type { GameEvent } from "../../../src/core";
import { buildAgentVisibleEvent } from "../../../src/game/engine/agent_visible_event_feed";
for (const type of [
  "red_moon_night_sealed",
  "red_moon_exile_delayed",
  "red_moon_delay_expired",
] as const)
  test(
    type + ": public Red Moon facts are visible to every seat with only canonical fields",
    () => {
      const { world } = redMoonCandidateWorld();
      const payload =
        type === "red_moon_delay_expired"
          ? { actorId: 4, day: 2 }
          : { actorId: 4, day: 1, night: 2 };
      const event = { timestamp: 1, type, payload } as GameEvent;
      for (const id of world.entityIds())
        expect(buildAgentVisibleEvent(world, event, id, 7)).toEqual({ seq: 7, type, payload });
    },
  );
test("Malformed Red Moon facts and extra secret fields never reach players", () => {
  const { world } = redMoonCandidateWorld();
  for (const payload of [
    { actorId: 4, day: 1, night: 3 },
    { actorId: 4, day: 1, night: 2, secret: "hidden" },
  ])
    expect(
      buildAgentVisibleEvent(
        world,
        { timestamp: 1, type: "red_moon_night_sealed", payload } as GameEvent,
        5,
        1,
      ),
    ).toBeNull();
  let reads = 0;
  const payload = {
    actorId: 4,
    day: 1,
    get night() {
      reads++;
      return 2;
    },
  };
  expect(
    buildAgentVisibleEvent(
      world,
      { timestamp: 1, type: "red_moon_night_sealed", payload } as GameEvent,
      5,
      1,
    ),
  ).toBeNull();
  expect(reads).toBe(0);
  expect(
    buildAgentVisibleEvent(
      world,
      { timestamp: 1, type: "red_moon_delay_expired", payload: { actorId: 4, day: 0 } },
      5,
      1,
    ),
  ).toBeNull();
});
