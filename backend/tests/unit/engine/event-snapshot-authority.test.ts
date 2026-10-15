/**
 * Unit tests: Event snapshot authority uses mutable/replaced payloads and detached facts;
 * literal single-source projection assertions check that visibility never rereads foreign
 * payload state. Inputs and expected outcomes remain the original literal or
 * immutable-fixture oracle; these module assertions invoke no model or complete-game
 * driver.
 */
import { test, expect } from "bun:test";
import { World, type GameEvent } from "../../../src/domain";
import { buildAgentVisibleEvent } from "../../../src/game/engine/agent_visible_event_feed";
const canary = "PRIVATE_OTHER_PLAYER_STATE_CANARY";
const cases: Array<[string, Record<string, unknown>, number, number[], Record<string, unknown>?]> =
  [
    ["modifier_choice_committed", { actorId: 1, day: 2, mode: "enhance", targetId: 2 }, 2, [1]],
    ["modifier_choice_skipped", { actorId: 1, day: 1, reason: "first_night" }, 2, [1]],
    [
      "modifier_bonus_resolved",
      { actorId: 1, day: 2, kind: "kill", targetId: 2, abstain: false },
      2,
      [1],
    ],
    ["time_consort_lock_committed", { actorId: 1, day: 1, targetId: 2 }, 2, [1]],
    ["time_consort_lock_skipped", { actorId: 1, day: 2, reason: "exhausted" }, 2, [1]],
    ["wolf_sorcerer_exchange_committed", { actorId: 1, day: 2, pair: [2, 3] }, 4, [1]],
    ["wolf_sorcerer_exchange_skipped", { actorId: 1, day: 1, reason: "not_started" }, 4, [1]],
    ["trickster_exchange_committed", { actorId: 1, day: 1, pair: [2, 3] }, 4, [1]],
    ["trickster_exchange_skipped", { actorId: 1, day: 2, reason: "exhausted" }, 4, [1]],
    ["order_prince_choice_committed", { actorId: 1, day: 1, activate: true }, 4, [1]],
    ["order_prince_revote_started", { actorId: 1 }, 2, []],
    ["exile_target_mapped", { requestedId: 2, effectiveId: 3, missed: false }, 4, []],
    ["death_shot_missed", { actorId: 1, reason: "no_effect" }, 4, []],
    ["cupid_lovers_chosen", { actorId: 1, day: 1, pairIds: [2, 3] }, 2, []],
    ["lover_recognized", { actorId: 1, partnerId: 2 }, 2, []],
    ["debate_started", { actorId: 1, targetId: 2, day: 1 }, 2, []],
    ["nightmare_fear_committed", { actorId: 1, day: 1, targetId: 2 }, 4, [1], { targetId: canary }],
  ];
for (const [type, base, swapAt, audience, lateFields] of cases)
  test("detached fact must be the only source of " + type, () => {
    const event: any = {
      timestamp: 1,
      type,
      payload: null,
      ...(audience.length ? { audience } : {}),
    };
    let calls = 0;
    event.payload = new Proxy(
      { ...base },
      {
        ownKeys(target) {
          calls++;
          if (calls === swapAt)
            event.payload = { ...base, ...(lateFields ?? { privateCanary: canary }) };
          return Reflect.ownKeys(target);
        },
      },
    );
    const result = buildAgentVisibleEvent(new World(), event as GameEvent, 1, 1);
    expect(calls).toBe(0);
    expect(result).toBeNull();
    expect(JSON.stringify(result)).not.toContain(canary);
  });
test("current Mist detached fact branch does not reread the replaced payload", () => {
  const base = { actorId: 1, day: 1, targetIds: [1, 2, 3] },
    event: any = { timestamp: 1, type: "alchemist_mist_chosen", audience: [1], payload: null };
  let calls = 0;
  event.payload = new Proxy(
    { ...base },
    {
      ownKeys(target) {
        if (++calls === 2) event.payload = { ...base, privateCanary: canary };
        return Reflect.ownKeys(target);
      },
    },
  );
  const result = buildAgentVisibleEvent(new World(), event, 1, 1);
  expect(calls).toBe(0);
  expect(result).toBeNull();
  expect(JSON.stringify(result)).not.toContain(canary);
});

test("descriptor callbacks must not transfer GhostBride private audience", () => {
  const payload = {
    policy: "awa_melbourne_ghost_bride_v1",
    groupId: "ghost-bride:1:1",
    day: 1,
    actorId: 1,
    recipientId: 2,
    text: canary,
  };
  const event: any = {
    timestamp: 1,
    type: "ghost_bride_partner_chat",
    audience: [1, 2],
    payload: null,
  };
  let calls = 0;
  event.payload = new Proxy(payload, {
    ownKeys(target) {
      if (++calls === 2) event.audience = [3];
      return Reflect.ownKeys(target);
    },
  });
  const result = buildAgentVisibleEvent(new World(), event as GameEvent, 3, 1);
  expect(JSON.stringify(result)).not.toContain(canary);
});
test("descriptor callbacks must not transfer Cupid actor ownership", () => {
  const payload = { actorId: 1, day: 1, pairIds: [3, 4] };
  const event: any = { timestamp: 1, type: "cupid_lovers_chosen", payload: null };
  let calls = 0;
  event.payload = new Proxy(payload, {
    ownKeys(target) {
      if (++calls === 2) payload.actorId = 2;
      return Reflect.ownKeys(target);
    },
  });
  expect(buildAgentVisibleEvent(new World(), event as GameEvent, 2, 1)).toBeNull();
});
test("descriptor callbacks must not transfer Nightmare owner after reader copied original actor", () => {
  const payload = { actorId: 1, day: 1, targetId: 5 };
  const event: any = {
    timestamp: 1,
    type: "nightmare_fear_committed",
    audience: [1],
    payload: null,
  };
  let calls = 0;
  event.payload = new Proxy(payload, {
    ownKeys(target) {
      if (++calls === 4) {
        payload.actorId = 2;
        event.audience = [2];
      }
      return Reflect.ownKeys(target);
    },
  });
  expect(buildAgentVisibleEvent(new World(), event as GameEvent, 2, 1)).toBeNull();
});
test("validated private Trickster fact must not become public by type replacement", () => {
  const payload = { actorId: 1, day: 1, pair: [3, 4] };
  const event: any = {
    timestamp: 1,
    type: "trickster_exchange_committed",
    audience: [1],
    payload: null,
  };
  let calls = 0;
  event.payload = new Proxy(payload, {
    ownKeys(target) {
      if (++calls === 2) {
        event.type = "day_speech";
        event.payload = { actorId: 1, text: canary };
      }
      return Reflect.ownKeys(target);
    },
  });
  expect(
    JSON.stringify(buildAgentVisibleEvent(new World(), event as GameEvent, 3, 1)),
  ).not.toContain(canary);
});

test("plain stable envelopes preserve legacy trimming and historical audiences", () => {
  const world = new World();
  const publicShot = {
    timestamp: 1,
    type: "player_shot",
    payload: { actorId: 1, targetId: 2, abilityId: "native:1:hunter_shot", deathActionId: 1 },
  } as GameEvent;
  expect(buildAgentVisibleEvent(world, publicShot, 3, 1)).toEqual({
    seq: 1,
    type: "player_shot",
    payload: { actorId: 1, targetId: 2 },
  });
  const privateChoice: Extract<GameEvent, { type: "modifier_choice_committed" }> = {
    timestamp: 1,
    type: "modifier_choice_committed",
    payload: { actorId: 1, day: 2, mode: "enhance", targetId: 2 },
    audience: [1],
  };
  const owner = buildAgentVisibleEvent(world, privateChoice, 1, 2);
  expect(owner).toEqual({
    seq: 2,
    type: "modifier_choice_committed",
    payload: { actorId: 1, day: 2, mode: "enhance", targetId: 2 },
  });
  expect(buildAgentVisibleEvent(world, privateChoice, 2, 1)).toBeNull();
  privateChoice.payload.targetId = 9;
  expect(owner!.payload.targetId).toBe(2);
  const historical = {
    timestamp: 1,
    type: "wolf_discussion",
    payload: { actorId: 1, text: "private", endChat: false, round: 1 },
    audience: [1, 2],
  } as GameEvent;
  expect(buildAgentVisibleEvent(world, historical, 2, 1)?.payload.text).toBe("private");
  expect(buildAgentVisibleEvent(world, historical, 3, 1)).toBeNull();
});
test("getters, cyclic or non-data envelopes are rejected before permissions or output", () => {
  let reads = 0;
  const valid = { timestamp: 1, type: "day_speech", payload: { actorId: 1, text: "public" } };
  const getter = Object.defineProperty({ ...valid }, "type", {
    enumerable: true,
    get() {
      reads++;
      return "day_speech";
    },
  });
  expect(buildAgentVisibleEvent(new World(), getter as GameEvent, 1, 1)).toBeNull();
  expect(reads).toBe(0);
  const nested = Object.defineProperty({ ...valid.payload }, "text", {
    enumerable: true,
    get() {
      reads++;
      return "private";
    },
  });
  expect(
    buildAgentVisibleEvent(new World(), { ...valid, payload: nested } as GameEvent, 1, 1),
  ).toBeNull();
  expect(reads).toBe(0);
  const cyclic: any = { ...valid, payload: {} };
  cyclic.payload.self = cyclic;
  expect(buildAgentVisibleEvent(new World(), cyclic, 1, 1)).toBeNull();
  for (const foreign of [
    new Date(),
    { ...valid, payload: { bad: () => null } },
    { ...valid, payload: { targetId: Infinity } },
  ])
    expect(buildAgentVisibleEvent(new World(), foreign as GameEvent, 1, 1)).toBeNull();
});
