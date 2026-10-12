import {
  ANIMAL_DREAM_EVENT_TYPES,
  readAnimalDreamFact,
  animalDreamFactAudience,
} from "@ai-werewolf-arena/game-text";
import {
  NOBLE_SECRET_BODY_EVENT_TYPES,
  readNobleSecretBodyFact,
  nobleSecretBodyVisibility,
} from "@ai-werewolf-arena/game-text";
import {
  FRAGRANT_PAIR_EVENT_TYPES,
  readFragrantPairFact,
  fragrantPairVisibility,
} from "@ai-werewolf-arena/game-text";
import {
  RADIANT_ECLIPSE_EVENT_TYPES,
  readRadiantEclipseFact,
  radiantEclipseAudience,
} from "@ai-werewolf-arena/game-text";
import { MIST_RAVEN_EVENT_TYPES, readMistRavenFact } from "@ai-werewolf-arena/game-text";
import { types } from "node:util";
import {
  readWolfSorcererExchangeFact,
  readWolfSorcererSkipFact,
} from "@ai-werewolf-arena/game-text";
import {
  readTricksterExchangeFact,
  readTricksterSkipFact,
  readExileMappingFact,
} from "@ai-werewolf-arena/game-text";
import { readOrderPrinceChoiceFact } from "@ai-werewolf-arena/game-text";
import { readOrderPrinceRevoteFact } from "@ai-werewolf-arena/game-text";
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

/** Every subsequent reader and permission check sees the same inert envelope. */
function snapshotEvent(event: GameEvent): GameEvent | null {
  const ancestors = new Set<object>();
  const inert = (value: unknown, depth: number): boolean => {
    // Declared optional fields may be undefined before the JSON wire boundary.
    if (
      value === undefined ||
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (
      !value ||
      typeof value !== "object" ||
      depth > 32 ||
      types.isProxy(value) ||
      ancestors.has(value)
    )
      return false;
    const array = Array.isArray(value),
      proto = Object.getPrototypeOf(value);
    if (
      (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) ||
      Object.getOwnPropertySymbols(value).length
    )
      return false;
    const fields = Object.getOwnPropertyDescriptors(value);
    if (array) {
      const length = fields.length?.value;
      if (
        !Number.isSafeInteger(length) ||
        length > 1024 ||
        Object.keys(fields).length !== length + 1 ||
        !Array.from({ length }, (_, i) => Object.hasOwn(fields, i)).every(Boolean)
      )
        return false;
    }
    ancestors.add(value);
    try {
      return Object.entries(fields).every(
        ([key, field]) =>
          (array && key === "length") ||
          (field.enumerable && Object.hasOwn(field, "value") && inert(field.value, depth + 1)),
      );
    } finally {
      ancestors.delete(value);
    }
  };
  try {
    if (!inert(event, 0)) return null;
    const copy = structuredClone(event);
    return typeof copy.type === "string" &&
      typeof copy.timestamp === "number" &&
      copy.payload !== null &&
      typeof copy.payload === "object" &&
      !Array.isArray(copy.payload)
      ? copy
      : null;
  } catch {
    return null;
  }
}

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
  const detached = snapshotEvent(event);
  if (!detached) return null;
  event = detached;
  if ((ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const f = readAnimalDreamFact(event.type, event.payload),
      visibility = f && animalDreamFactAudience(f.type);
    if (!f || visibility === "god") return null;
    if (
      visibility === "actor" &&
      (!("actorId" in f.payload) ||
        f.payload.actorId !== actorId ||
        !("audience" in event) ||
        !Array.isArray(event.audience) ||
        event.audience.length !== 1 ||
        event.audience[0] !== actorId)
    )
      return null;
    if (visibility === "public" && "audience" in event) return null;
    return { seq: visibleSeq, type: f.type, payload: { ...f.payload } };
  }
  if ((FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const fact = readFragrantPairFact(event.type, event.payload);
    if (
      !fact ||
      fragrantPairVisibility(event.type) !== "actor" ||
      fact.actorId !== actorId ||
      !("audience" in event) ||
      !Array.isArray(event.audience) ||
      event.audience.length !== 1 ||
      event.audience[0] !== actorId
    )
      return null;
    return { seq: visibleSeq, type: event.type, payload: { ...fact } };
  }
  if ((NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const fact = readNobleSecretBodyFact(event.type, event.payload),
      visibility = nobleSecretBodyVisibility(event.type);
    if (!fact || visibility === "god") return null;
    if (
      visibility === "actor" &&
      (fact.actorId !== actorId ||
        !("audience" in event) ||
        !Array.isArray(event.audience) ||
        event.audience.length !== 1 ||
        event.audience[0] !== actorId)
    )
      return null;
    if (visibility === "public" && "audience" in event) return null;
    return { seq: visibleSeq, type: event.type, payload: { ...fact } };
  }
  if ((RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const fact = readRadiantEclipseFact(event.type, event.payload);
    if (!fact) return null;
    const expected = radiantEclipseAudience(event.type, fact);
    if (
      expected.length !== 1 ||
      expected[0] !== actorId ||
      !("audience" in event) ||
      !Array.isArray(event.audience) ||
      event.audience.length !== 1 ||
      event.audience[0] !== actorId
    )
      return null;
    return { seq: visibleSeq, type: event.type, payload: { ...fact } };
  }
  const mistType = event.type;
  if ((MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(mistType)) {
    try {
      // Authorization and output use one detached fact. Never validate one object
      // and then clone a mutable source again after a foreign descriptor callback.
      const audience = "audience" in event ? structuredClone(event.audience) : null;
      if (
        !Array.isArray(audience) ||
        !audience.every((id) => Number.isSafeInteger(id) && id > 0) ||
        new Set(audience).size !== audience.length
      )
        return null;
      const fact = readMistRavenFact(mistType, event.payload);
      if (
        !fact ||
        !audience.includes(actorId) ||
        ("actorId" in fact && (fact.actorId !== actorId || audience.length !== 1))
      )
        return null;
      return { seq: visibleSeq, type: mistType, payload: { ...fact } };
    } catch {
      return null;
    }
  }
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
  if (
    event.type === "order_prince_revote_started" &&
    !readOrderPrinceRevoteFact(event.type, event.payload)
  )
    return null;
  if (
    event.type === "order_prince_choice_committed" &&
    !readOrderPrinceChoiceFact(event.type, event.payload)
  )
    return null;
  if (
    event.type === "trickster_exchange_committed" &&
    !readTricksterExchangeFact(event.type, event.payload)
  )
    return null;
  if (
    event.type === "trickster_exchange_skipped" &&
    !readTricksterSkipFact(event.type, event.payload)
  )
    return null;
  if (event.type === "exile_target_mapped" && !readExileMappingFact(event.type, event.payload))
    return null;
  if (
    event.type === "wolf_sorcerer_exchange_committed" &&
    !readWolfSorcererExchangeFact(event.type, event.payload)
  )
    return null;
  if (
    event.type === "wolf_sorcerer_exchange_skipped" &&
    !readWolfSorcererSkipFact(event.type, event.payload)
  )
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
