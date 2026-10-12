/**
 * Package unit/type contract for the event and request DTO ownership move.
 * Literal expected IDs and payloads verify public data shapes and the original
 * conditional audience, required context and optional feature fields. Type
 * counterexamples check declared constraints without running an engine, provider
 * or lease. The projected payload stays open; these types never parse unknown
 * data, prove permissions or promise hostile-object rejection at runtime.
 */
import { expect, test } from "bun:test";
import {
  WOLF_TEAM_EVENT_TYPES,
  type GameEvent,
  type EventPayloadMap,
  type PlayerVisibleEvent,
} from "@ai-werewolf-arena/game-contract/events";
import type {
  ActionRequest,
  ActionRequestContext,
  ActionRequestExtras,
} from "@ai-werewolf-arena/game-contract/requests";
import {
  Camp,
  Phase,
  WOLF_TEAM_EVENT_TYPES as rootWolfEvents,
  type LoversComponent,
} from "@ai-werewolf-arena/game-contract";
// @ts-expect-error Runtime decision providers remain outside serialized contracts.
import type { ActionProvider } from "@ai-werewolf-arena/game-contract";
// @ts-expect-error Domain commit selections have not moved into the public request DTO.
import type { KnightDuelSelection } from "@ai-werewolf-arena/game-contract/requests";

test("the public wolf sequence retains its exact order, singleton and original mutability", () => {
  expect(WOLF_TEAM_EVENT_TYPES).toEqual([
    "mist_knife_drawn",
    "wolf_tactical_order",
    "wolf_discussion",
    "wolf_discussion_ended",
    "wolf_kill_vote_cast",
  ]);
  expect(WOLF_TEAM_EVENT_TYPES).toBe(rootWolfEvents);
  expect(Object.isFrozen(WOLF_TEAM_EVENT_TYPES)).toBe(false);
});

test("event discrimination preserves private readonly audience and public Animal reveals", () => {
  type Fear = Extract<GameEvent, { type: "nightmare_fear_committed" }>;
  const fear: Fear = {
    timestamp: 1,
    type: "nightmare_fear_committed",
    payload: { actorId: 2, day: 1, targetId: null },
    audience: [2],
  };
  // @ts-expect-error A private event must retain its explicit historical audience.
  const noAudience: Fear = {
    timestamp: 1,
    type: "nightmare_fear_committed",
    payload: { actorId: 2, day: 1, targetId: null },
  };
  const wrongPayload: Fear = {
    timestamp: 1,
    type: "nightmare_fear_committed",
    // @ts-expect-error A payload belonging to a different event is not a fear choice.
    payload: { playerId: 2, day: 1 },
    audience: [2],
  };
  // @ts-expect-error Private Animal contributions retain required audience through the extended map.
  const noFoxAudience: Extract<GameEvent, { type: "animal_fox_chosen" }> = {
    timestamp: 1,
    type: "animal_fox_chosen",
    payload: { policy: "awa_animal_dream_v1", actorId: 2, day: 1, targetId: null },
  };
  const cat: Extract<GameEvent, { type: "animal_cat_revealed" }> = {
    timestamp: 2,
    type: "animal_cat_revealed",
    payload: { policy: "awa_animal_dream_v1", actorId: 3, day: 1 },
  };
  if (false) {
    // @ts-expect-error Historical audience remains a readonly property.
    fear.audience = [];
    // @ts-expect-error Historical audience members cannot be edited through this contract.
    fear.audience.push(3);
  }
  void [noAudience, wrongPayload, noFoxAudience];
  expect(fear.audience).toEqual([2]);
  expect(cat).not.toHaveProperty("audience");
});

test("Cupid relation references neutral immutable metadata and player projection remains open", () => {
  const relation: LoversComponent = {
    actorId: 4,
    day: 1,
    policy: "netease_2017_cupid_follows_lovers_v1",
    pairIds: [2, 3],
    pairCamps: [Camp.Good, Camp.Wolf],
    groupId: "cupid_lovers",
    mixed: true,
  };
  const payload: EventPayloadMap["cupid_relation_resolved"] = relation;
  const projected: PlayerVisibleEvent = {
    seq: 5,
    type: "future_projected_event",
    payload: { target: 2, targetId: 3, custom: { original: "Raw {text}" } },
  };
  // @ts-expect-error The projected local sequence retains its numeric type.
  const badSequence: PlayerVisibleEvent = { seq: "5", type: "custom", payload: {} };
  if (false) {
    // @ts-expect-error Pair members remain readonly metadata rather than component writes.
    payload.pairIds[0] = 5;
    // @ts-expect-error The relation contains only the original enum-typed factions.
    const rawCamps: LoversComponent["pairCamps"] = ["good", "wolf"];
    void rawCamps;
  }
  void badSequence;
  expect(payload).toBe(relation);
  expect(projected.payload.custom).toEqual({ original: "Raw {text}" });
});

test("request context keeps four required fields and its original optional mutable and readonly extras", () => {
  const context: ActionRequestContext = {
    day: 1,
    stage: "witch",
    visible_events: [],
    turn_constraints: {},
  };
  const request: ActionRequest = {
    phase: Phase.Night,
    actorId: 2,
    allowedTools: ["use_potion"],
    context,
  };
  const extras: ActionRequestExtras = {
    wolf_target: null,
    shoot_candidates: [3, 4],
    sheriff_candidates: [3],
    allow_fallback: false,
    action_failure_policy: "error",
    retry_notice_message: { key: "common.player", parameters: { id: 2 } },
  };
  const timed: ActionRequest = { ...request, deadlineAtMs: 123 };
  // @ts-expect-error Day is a required common request field.
  const noDay: ActionRequestContext = { stage: "witch", visible_events: [], turn_constraints: {} };
  // @ts-expect-error Stage is a required common request field.
  const noStage: ActionRequestContext = { day: 1, visible_events: [], turn_constraints: {} };
  // @ts-expect-error Visible events are required even for the empty initial feed.
  const noFeed: ActionRequestContext = { day: 1, stage: "witch", turn_constraints: {} };
  // @ts-expect-error Turn constraints are required even when the constraint object is empty.
  const noConstraints: ActionRequestContext = { day: 1, stage: "witch", visible_events: [] };
  // @ts-expect-error Feature extras do not add an arbitrary string index.
  const unknownExtra: ActionRequestExtras = { invented_flag: true };
  // @ts-expect-error Strict action failure policy retains its single original literal.
  const changedFailure: ActionRequestExtras = { action_failure_policy: "fallback" };
  if (false) {
    // @ts-expect-error Private shoot candidates retain their readonly list type.
    extras.shoot_candidates?.push(5);
  }
  extras.sheriff_candidates?.push(4);
  context.visible_events.push({ seq: 1, type: "custom", payload: {} });
  void [noDay, noStage, noFeed, noConstraints, unknownExtra, changedFailure];
  expect(request).not.toHaveProperty("deadlineAtMs");
  expect(timed.deadlineAtMs).toBe(123);
  expect(extras.sheriff_candidates).toEqual([3, 4]);
  expect(context.visible_events).toHaveLength(1);
});
