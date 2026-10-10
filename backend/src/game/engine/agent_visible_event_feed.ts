import { readMagicianExchangeFact, readDeathShotMissFact } from "@ai-werewolf-arena/game-text";
import { readRedMoonNextNightFact, readRedMoonExpiryFact } from "@ai-werewolf-arena/game-text";
import { readNightmareFearFact } from "@ai-werewolf-arena/game-text";
import { DEMON_HUNTER_EVENT_TYPES, readDemonHunterEventFact } from "@ai-werewolf-arena/game-text";
import { GHOST_BRIDE_EVENT_TYPES, readGhostBrideEventFact } from "@ai-werewolf-arena/game-text";
import { readLonelyGirlEventFact } from "@ai-werewolf-arena/game-text";
import { WILD_CHILD_EVENT_TYPES, readWildChildEventFact } from "@ai-werewolf-arena/game-text";
import { SHAPESHIFTER_EVENT_TYPES, readShapeshifterEventFact } from "@ai-werewolf-arena/game-text";
import { THIEF_EVENT_TYPES, readThiefEventFact } from "@ai-werewolf-arena/game-text";
import {
  WALL_EVENT_TYPES,
  readWallEventFact,
  readCupidEventFact,
  CUPID_EVENT_TYPES,
  readDebateEventFact,
  DEBATE_EVENT_TYPES,
} from "@ai-werewolf-arena/game-text";
import { EntityId, GameEvent, PlayerVisibleEvent } from "../../core/domain/model";
import { World } from "../../core/domain/world";
import { getDefaultAgentEventVisibilityRegistry } from "../mechanisms";
import { projectAbilitySource } from "../mechanisms/roles/abilities";

/**
 * 把领域事件投影为指定玩家可见的紧凑结构化事件。
 *
 * visibleSeq 使用指定玩家可见事件流中的连续单调序号，不能传入领域事件的
 * 全局位置，否则序号缺口会泄露私有行动的数量与时序。时间戳、日次和阶段
 * 不在每条事件中重复：当前回合已经单独携带这些状态，省略它们可以降低长局
 * token 消耗。
 * 未在可见性白名单中的新事件默认不可见，避免新增机制意外泄露私有信息。
 */
export function buildAgentVisibleEvent(
  world: World,
  event: GameEvent,
  actorId: EntityId,
  visibleSeq: number,
): PlayerVisibleEvent | null {
  if (
    event.type === "lonely_girl_admired_chosen" &&
    !readLonelyGirlEventFact(event.type, event.payload)
  )
    return null;
  if (
    (CUPID_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readCupidEventFact(event.type, event.payload)
  )
    return null;
  if (
    (DEBATE_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readDebateEventFact(event.type, event.payload)
  )
    return null;
  if (
    (WALL_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readWallEventFact(event.type, event.payload)
  )
    return null;
  if (
    (THIEF_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readThiefEventFact(event.type, event.payload)
  )
    return null;
  if (
    (WILD_CHILD_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readWildChildEventFact(event.type, event.payload)
  )
    return null;
  if (
    (SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readShapeshifterEventFact(event.type, event.payload)
  )
    return null;
  if (
    (GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readGhostBrideEventFact(event.type, event.payload)
  )
    return null;
  if (
    (DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readDemonHunterEventFact(event.type, event.payload)
  )
    return null;
  if (
    event.type === "nightmare_fear_committed" &&
    !readNightmareFearFact(event.type, event.payload)
  )
    return null;
  if (
    (event.type === "red_moon_night_sealed" || event.type === "red_moon_exile_delayed") &&
    !readRedMoonNextNightFact(event.type, event.payload)
  )
    return null;
  if (event.type === "red_moon_delay_expired" && !readRedMoonExpiryFact(event.type, event.payload))
    return null;
  if (
    event.type === "magician_exchange_committed" &&
    !readMagicianExchangeFact(event.type, event.payload)
  )
    return null;
  if (event.type === "death_shot_missed" && !readDeathShotMissFact(event.type, event.payload))
    return null;
  const visibility = getDefaultAgentEventVisibilityRegistry();
  if (!visibility.canView(world, event, actorId)) {
    return null;
  }
  if (event.type === "hunter_shot" || event.type === "player_shot") {
    return {
      seq: visibleSeq,
      type: "player_shot",
      payload: {
        actorId: event.type === "hunter_shot" ? event.payload.hunterId : event.payload.actorId,
        targetId: event.payload.targetId,
      },
    };
  }
  return {
    seq: visibleSeq,
    type: event.type,
    payload: projectPayload(event),
  };
}

/** Project the authorized wire fields, keeping internal metadata out of player prompts. */
function projectPayload(event: GameEvent): Record<string, unknown> {
  switch (event.type) {
    case "red_moon_night_sealed":
    case "red_moon_exile_delayed":
      return { actorId: event.payload.actorId, day: event.payload.day, night: event.payload.night };
    case "red_moon_delay_expired":
      return { actorId: event.payload.actorId, day: event.payload.day };
    case "magician_exchange_committed": {
      const fact = readMagicianExchangeFact(event.type, event.payload);
      return fact ? { day: fact.day, pair: fact.pair } : {};
    }
    case "nightmare_fear_committed":
      return { day: event.payload.day, targetId: event.payload.targetId };
    case "demon_hunter_chosen":
      return {
        policy: event.payload.policy,
        day: event.payload.day,
        targetId: event.payload.targetId,
      };
    case "lonely_girl_admired_chosen":
      return {
        policy: event.payload.policy,
        actorId: event.payload.actorId,
        day: 1,
        targetId: event.payload.targetId,
      };
    case "wild_child_transformed":
      return {
        actorId: event.payload.actorId,
        day: event.payload.day,
        eligibleNight: event.payload.eligibleNight,
        camp: event.payload.camp,
      };
    case "player_role_revealed":
      return { playerId: event.payload.playerId, role: event.payload.role };
    case "black_market_trade_committed":
      return {
        actorId: event.payload.actorId,
        day: event.payload.day,
        targetId: event.payload.targetId,
        skill: event.payload.skill,
      };
    case "black_market_trade_skipped":
      return { actorId: event.payload.actorId, day: event.payload.day };
    case "death_ability_changed": {
      const p = event.payload;
      return {
        actorId: p.actorId,
        abilityId: p.abilityId,
        operation: p.operation,
        grantedNight: p.grantedNight,
        armedOnNight: p.armedOnNight,
        remaining: p.remaining,
        disabled: p.disabled,
        deathExpired: p.deathExpired,
      };
    }
    case "awakened_inherited":
      return {
        actorId: event.payload.actorId,
        day: event.payload.day,
        firstKnifeNight: event.payload.firstKnifeNight,
      };
    case "awakened_mimicked":
      return {
        actorId: event.payload.actorId,
        day: event.payload.day,
        targetId: event.payload.targetId,
        role: event.payload.role,
      };
    case "awakened_ready":
      return {
        actorId: event.payload.actorId,
        activationNight: event.payload.activationNight,
        activeFromNight: event.payload.activeFromNight,
        role: event.payload.role,
      };
    case "awakened_mimic_skipped":
    case "awakened_skill_skipped":
      return { actorId: event.payload.actorId, day: event.payload.day };
    case "awakened_poison_used":
    case "awakened_guard_chosen":
    case "awakened_attack_chosen":
      return {
        actorId: event.payload.actorId,
        day: event.payload.day,
        targetId: event.payload.targetId,
      };
  }
  if (event.type === "ability_changed") {
    const payload = event.payload;
    return structuredClone({
      actorId: payload.actorId,
      abilityId: payload.abilityId,
      kind: payload.kind,
      operation: payload.operation,
      source: projectAbilitySource(payload.source, payload.sourceDisclosed),
      startsOnDay: payload.startsOnDay,
      ...(payload.expiresAfterDay === undefined
        ? {}
        : { expiresAfterDay: payload.expiresAfterDay }),
      maxUses: payload.maxUses,
    });
  }
  if (event.type === "vote_summary") {
    const { tally: _derivedTally, ...payload } = event.payload;
    return structuredClone(payload);
  }
  return structuredClone({ ...event.payload });
}

/**
 * 返回只读追加的玩家事件流。seq 仅按投影后仍可见的事件递增，因此不同数量的
 * 隐藏事件不会改变玩家协议。这里不截断；Provider 使用 seq 取增量，并在送模时
 * 控制消息窗口，避免“数组截断 + 长度游标”造成新事件永久丢失。
 */
export function buildAgentVisibleEventFeed(
  world: World,
  events: GameEvent[],
  actorId: EntityId,
): PlayerVisibleEvent[] {
  const visible: PlayerVisibleEvent[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const projected = buildAgentVisibleEvent(world, events[index], actorId, visible.length + 1);
    if (projected) visible.push(projected);
  }
  return visible;
}
