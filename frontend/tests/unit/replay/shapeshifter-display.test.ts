import { expect, test } from "bun:test";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";
import { readReplayEvent } from "../../../src/replay/replay-event-reader";
const fact = (type: string, payload: Record<string, unknown>): ReplayEvent => ({
  seq: 1,
  timestamp: "2026-10-09T00:00:00Z",
  phase: "night",
  day: 1,
  type,
  payload,
});
const policy = "awa_netease_shapeshifter_two_extra_villagers_v1";
test("Shapeshifter strict initial/choice facts reject malformed rows/getters without partial identity/death effects", () => {
  const p = { policy, actorId: 1, day: 1, slot: 0, role: "wolf", camp: "wolf" };
  expect(readReplayEvent(fact("shapeshifter_identity_chosen", p), [1, 2])?.effects).toEqual([
    { kind: "identity_changed", playerId: 1, role: "wolf", camp: "wolf" },
  ]);
  for (const bad of [
    { ...p, actorId: 3 },
    { ...p, camp: "good" },
    { ...p, slot: null },
    { ...p, role: "seer" },
    { ...p, extra: 1 },
  ])
    expect(readReplayEvent(fact("shapeshifter_identity_chosen", bad), [1, 2])).toBeNull();
  const initial = {
    policy,
    boardSize: 6,
    roles: ["shapeshifter", "wolf", "wolf", "seer", "witch", "hunter", "villager", "villager"],
  };
  expect(readReplayEvent(fact("shapeshifter_initial_deal", initial), [1, 2])?.effects).toEqual([]);
  for (const bad of [
    { ...initial, policy: "bad" },
    { ...initial, roles: [] },
    { ...initial, boardSize: 7 },
    { ...initial, actorId: 1 },
  ])
    expect(readReplayEvent(fact("shapeshifter_initial_deal", bad), [1, 2])).toBeNull();
  let reads = 0;
  expect(
    readReplayEvent(
      fact("shapeshifter_initial_deal", {
        ...initial,
        get roles() {
          reads++;
          return initial.roles;
        },
      }),
      [1, 2],
    ),
  ).toBeNull();
  expect(reads).toBe(0);
});
