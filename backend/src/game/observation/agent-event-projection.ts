/**
 * 负责 Agent 事件的全家族读取、受众判断和字段投影。输入为事件、玩家编号及窄查询端口；
 * 事件流消费 Node 的同一脱离副本，布尔入口保留原事实引用；输出保持两种旧模式的实际字段与拒绝顺序。
 * 事件流的结构 reader 消费安全副本；布尔入口保留 typed GameEvent 的原读取信任语义，不承诺 unknown 零 trap。
 * 本模块不直接持有 World、角色、原体或资源写权限；显式 trusted 回调仍可具有其原副作用。
 * 历史 audience 不按当前阵营重算，未知事件默认拒绝；已有自定义规则和恶魔身份查询只在原分支调用。
 * 这里不提交行动、付款或更新知识。可见性模式保留旧公开 API；事件流模式保留额外读器与裁剪。
 */
import {
  ANIMAL_DREAM_EVENT_TYPES,
  animalDreamFactAudience,
} from "@ai-werewolf-arena/game-contract/facts/animal-dream";
import {
  NOBLE_SECRET_BODY_EVENT_TYPES,
  nobleSecretBodyVisibility,
} from "@ai-werewolf-arena/game-contract/facts/noble-secret-body";
import {
  FRAGRANT_PAIR_EVENT_TYPES,
  fragrantPairVisibility,
} from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
import {
  RADIANT_ECLIPSE_EVENT_TYPES,
  radiantEclipseAudience,
} from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import { MIST_RAVEN_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/mist-raven";
import { DEMON_HUNTER_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/demon-hunter";
import { GHOST_BRIDE_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import { WILD_CHILD_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/wild-child";
import { SHAPESHIFTER_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/shapeshifter";
import { THIEF_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/thief";
import { WALL_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/wall-notes";
import { CUPID_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/cupid";
import { DEBATE_EVENT_TYPES } from "@ai-werewolf-arena/game-contract/facts/debate";
import {
  WOLF_TEAM_EVENT_TYPES,
  type EntityId,
  type GameEvent,
  type PlayerVisibleEvent,
  type EventPayloadMap,
  type AbilitySource,
} from "@ai-werewolf-arena/game-contract";

import { readAgentEventFact, type PreparedAgentEvent } from "./agent-event-facts";

/** 仅在命中原分支时执行的身份查询和显式自定义规则；不是行动许可或 World 通道。 */
export interface AgentEventVisibilityQueries {
  demonHunterActorId(): EntityId | null;
  custom(
    event: GameEvent,
    actorId: EntityId,
  ): { handled: false } | { handled: true; visible: boolean };
}

/** 字段投影只得到原可见性调用和来源裁剪函数，不获取库存、阶段控制或状态写权。 */
export interface AgentEventProjectionQueries {
  canView(event: GameEvent, actorId: EntityId): boolean;
  projectAbilitySource(
    origin: () => EventPayloadMap["ability_changed"]["source"],
    disclosed: () => boolean,
  ): EventPayloadMap["ability_changed"]["source"] | { kind: AbilitySource["kind"] };
}

const PUBLIC_EVENT_TYPES = new Set([
  "red_moon_night_sealed",
  "red_moon_exile_delayed",
  "red_moon_delay_expired",
  "wall_notes_started",
  "wall_notes_published",
  "wall_notes_canceled",
  "order_prince_revote_started",
  "debater_revealed",
  "debate_started",
  "debate_speech",
  "debate_resolved",
  "debate_canceled",
  "player_role_revealed",
  "phase_changed",
  "day_speech",
  "night_resolved",
  "bear_roared",
  "vote_summary",
  "voted_out",
  "game_over",
  "wolf_self_destruct",
  "white_wolf_king_self_destruct",
  "knight_duel",
  "death_shot_blocked",
  "additional_deaths",
  "hunter_shot",
  "player_shot",
  "wolf_king_shot",
  "mechanical_shot",
  "idiot_revealed",
  "last_words_granted",
  "last_words_spoken",
  "sheriff_nomination_summary",
  "sheriff_withdraw_summary",
  "sheriff_candidates_finalized",
  "sheriff_pk_started",
  "exile_pk_started",
  "sheriff_vote_summary",
  "sheriff_badge_transferred",
  "sheriff_badge_destroyed",
  "sheriff_direction_chosen",
]);

const WOLVES_ONLY_EVENT_TYPES = new Set<string>(WOLF_TEAM_EVENT_TYPES);

const ACTOR_ONLY_EVENT_TYPES = new Set([
  "lonely_girl_admired_chosen",
  "wild_child_model_chosen",
  "wild_child_transformed",
  "wild_child_pack_activated",
  "thief_identity_chosen",
  "shapeshifter_identity_chosen",
  "ability_changed",
  "black_market_trade_skipped",
  "black_market_trade_committed",
  "death_ability_changed",
  "seer_checked",
  "gravekeeper_reported",
  "dream_applied",
  "charm_applied",
  "hidden_wolf_awakened",
  "gargoyle_awakened",
  "mechanical_awakened",
  "mechanical_mode_selected",
  "mechanical_mimicked",
  "mechanical_mimic_skipped",
  "mechanical_skill_skipped",
  "mechanical_poison_used",
  "mechanical_guard_chosen",
  "mechanical_attack_chosen",
  "awakened_inherited",
  "awakened_mimicked",
  "awakened_mimic_skipped",
  "awakened_ready",
  "awakened_skill_skipped",
  "awakened_poison_used",
  "awakened_guard_chosen",
  "awakened_attack_chosen",
  "role_inspected",
  "role_inspection_skipped",
  "lucky_ability_skipped",
  "merchant_trade_committed",
  "merchant_trade_skipped",
  "hybrid_exemplar_chosen",
  "cupid_lovers_chosen",
  "lover_recognized",
  "witch_potion_used",
  "witch_potion_skipped",
  "guard_applied",
]);

/** 既有独立布尔 API：保留其读取顺序与模式，不替代事件流额外校验。 */
function canViewAgentEventWithFacts(
  event: GameEvent,
  actorId: EntityId,
  queries: AgentEventVisibilityQueries,
  prepared?: PreparedAgentEvent,
): boolean {
  if ((ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const f = readAgentEventFact("readAnimalDreamFact", event.type, event.payload, prepared),
      v = f && animalDreamFactAudience(f.type);
    return (
      !!f &&
      (v === "public"
        ? !("audience" in event)
        : v === "actor" &&
          "actorId" in f.payload &&
          f.payload.actorId === actorId &&
          "audience" in event &&
          Array.isArray(event.audience) &&
          event.audience.length === 1 &&
          event.audience[0] === actorId)
    );
  }
  if ((FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const fact = readAgentEventFact("readFragrantPairFact", event.type, event.payload, prepared);
    return (
      !!fact &&
      fragrantPairVisibility(event.type) === "actor" &&
      fact.actorId === actorId &&
      "audience" in event &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId
    );
  }
  if ((NOBLE_SECRET_BODY_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const fact = readAgentEventFact("readNobleSecretBodyFact", event.type, event.payload, prepared),
      visibility = nobleSecretBodyVisibility(event.type);
    if (!fact || visibility === "god") return false;
    if (visibility === "public") return !("audience" in event);
    return (
      fact.actorId === actorId &&
      "audience" in event &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId
    );
  }
  if ((RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const fact = readAgentEventFact("readRadiantEclipseFact", event.type, event.payload, prepared);
    if (!fact) return false;
    const expected = radiantEclipseAudience(event.type, fact);
    return (
      expected.length === 1 &&
      expected[0] === actorId &&
      "audience" in event &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId
    );
  }
  if (
    (MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(event.type) &&
    event.type !== "mist_knife_drawn"
  ) {
    const fact = readAgentEventFact("readMistRavenFact", event.type, event.payload, prepared);
    return (
      !!fact &&
      "actorId" in fact &&
      fact.actorId === actorId &&
      "audience" in event &&
      event.audience?.length === 1 &&
      event.audience[0] === actorId
    );
  }
  if (
    event.type === "mist_knife_drawn" &&
    !readAgentEventFact("readMistRavenFact", event.type, event.payload, prepared)
  )
    return false;
  if (event.type === "modifier_conflict_resolved") return false;
  if (
    event.type === "modifier_choice_committed" ||
    event.type === "modifier_choice_skipped" ||
    event.type === "modifier_bonus_resolved"
  ) {
    const fact =
      readAgentEventFact("readModifierChoiceFact", event.type, event.payload, prepared) ??
      readAgentEventFact("readModifierSkipFact", event.type, event.payload, prepared) ??
      readAgentEventFact("readModifierBonusFact", event.type, event.payload, prepared);
    return (
      !!fact &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId &&
      fact.actorId === actorId
    );
  }
  if (event.type === "time_consort_reflected") return false;
  if (event.type === "time_consort_lock_committed" || event.type === "time_consort_lock_skipped") {
    const f =
      readAgentEventFact("readTimeConsortChoiceFact", event.type, event.payload, prepared) ??
      readAgentEventFact("readTimeConsortSkipFact", event.type, event.payload, prepared);
    return (
      !!f &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId &&
      f.actorId === actorId
    );
  }
  if (
    event.type === "wolf_sorcerer_exchange_committed" ||
    event.type === "wolf_sorcerer_exchange_skipped"
  ) {
    const f =
      readAgentEventFact("readWolfSorcererExchangeFact", event.type, event.payload, prepared) ??
      readAgentEventFact("readWolfSorcererSkipFact", event.type, event.payload, prepared);
    return (
      !!f &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId &&
      f.actorId === actorId
    );
  }
  if (
    event.type === "trickster_exchange_committed" ||
    event.type === "trickster_exchange_skipped"
  ) {
    const f =
      readAgentEventFact("readTricksterExchangeFact", event.type, event.payload, prepared) ??
      readAgentEventFact("readTricksterSkipFact", event.type, event.payload, prepared);
    return (
      !!f &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId &&
      f.actorId === actorId
    );
  }
  if (event.type === "exile_target_mapped")
    return !!readAgentEventFact("readExileMappingFact", event.type, event.payload, prepared);
  if (event.type === "order_prince_choice_committed") {
    const fact = readAgentEventFact(
      "readOrderPrinceChoiceFact",
      event.type,
      event.payload,
      prepared,
    );
    return (
      !!fact &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId &&
      fact.actorId === actorId
    );
  }
  if (event.type === "death_shot_missed")
    return !!readAgentEventFact("readDeathShotMissFact", event.type, event.payload, prepared);
  if (event.type === "magician_exchange_committed") {
    const fact = readAgentEventFact(
      "readMagicianExchangeFact",
      event.type,
      event.payload,
      prepared,
    );
    return (
      !!fact &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId &&
      fact.actorId === actorId
    );
  }
  if (event.type === "nightmare_fear_committed")
    return (
      !!readAgentEventFact("readNightmareFearFact", event.type, event.payload, prepared) &&
      Array.isArray(event.audience) &&
      event.audience.length === 1 &&
      event.audience[0] === actorId &&
      event.payload.actorId === actorId
    );

  if (
    WOLVES_ONLY_EVENT_TYPES.has(event.type) ||
    (GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(event.type)
  ) {
    // 缺少历史受众则拒绝；当前身份既不能补发旧秘密，
    // 也不能撤销事件发表时已明确发给该玩家的事实。
    return "audience" in event && event.audience.includes(actorId);
  }
  if (
    ["demon_hunter_chosen", "demon_hunter_cancelled", "demon_hunter_poison_immune"].includes(
      event.type,
    )
  )
    return (
      event.type === "demon_hunter_chosen" &&
      queries.demonHunterActorId() === actorId &&
      "audience" in event &&
      event.audience.length === 1 &&
      event.audience[0] === actorId &&
      event.payload.actorId === actorId
    );
  const custom = queries.custom(event, actorId);
  if (custom.handled) return custom.visible;
  if (PUBLIC_EVENT_TYPES.has(event.type)) return true;
  if (ACTOR_ONLY_EVENT_TYPES.has(event.type) && "actorId" in event.payload) {
    return event.payload.actorId === actorId;
  }
  return false;
}

/** 事件流模式：读取、授权和裁剪只使用 Node 已取得的同一 inert 副本。 */
function projectAgentEventWithFacts(
  event: GameEvent,
  actorId: EntityId,
  visibleSeq: number,
  queries: AgentEventProjectionQueries,
  prepared?: PreparedAgentEvent,
): PlayerVisibleEvent | null {
  if ((ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(event.type)) {
    const f = readAgentEventFact("readAnimalDreamFact", event.type, event.payload, prepared),
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
    const fact = readAgentEventFact("readFragrantPairFact", event.type, event.payload, prepared);
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
    const fact = readAgentEventFact("readNobleSecretBodyFact", event.type, event.payload, prepared),
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
    const fact = readAgentEventFact("readRadiantEclipseFact", event.type, event.payload, prepared);
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
      // 授权和输出消费同一脱离副本；不得检查一个对象后，
      // 再通过外来回调重新读取可变原始对象。
      const audience = "audience" in event ? structuredClone(event.audience) : null;
      if (
        !Array.isArray(audience) ||
        !audience.every((id) => Number.isSafeInteger(id) && id > 0) ||
        new Set(audience).size !== audience.length
      )
        return null;
      const fact = readAgentEventFact("readMistRavenFact", mistType, event.payload, prepared);
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
    !readAgentEventFact("readLonelyGirlEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (CUPID_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readAgentEventFact("readCupidEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (DEBATE_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readAgentEventFact("readDebateEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (WALL_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readAgentEventFact("readWallEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (THIEF_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readAgentEventFact("readThiefEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (WILD_CHILD_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readAgentEventFact("readWildChildEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readAgentEventFact("readShapeshifterEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readAgentEventFact("readGhostBrideEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(event.type) &&
    !readAgentEventFact("readDemonHunterEventFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "nightmare_fear_committed" &&
    !readAgentEventFact("readNightmareFearFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    (event.type === "red_moon_night_sealed" || event.type === "red_moon_exile_delayed") &&
    !readAgentEventFact("readRedMoonNextNightFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "red_moon_delay_expired" &&
    !readAgentEventFact("readRedMoonExpiryFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "magician_exchange_committed" &&
    !readAgentEventFact("readMagicianExchangeFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "death_shot_missed" &&
    !readAgentEventFact("readDeathShotMissFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "order_prince_revote_started" &&
    !readAgentEventFact("readOrderPrinceRevoteFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "order_prince_choice_committed" &&
    !readAgentEventFact("readOrderPrinceChoiceFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "trickster_exchange_committed" &&
    !readAgentEventFact("readTricksterExchangeFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "trickster_exchange_skipped" &&
    !readAgentEventFact("readTricksterSkipFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "exile_target_mapped" &&
    !readAgentEventFact("readExileMappingFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "wolf_sorcerer_exchange_committed" &&
    !readAgentEventFact("readWolfSorcererExchangeFact", event.type, event.payload, prepared)
  )
    return null;
  if (
    event.type === "wolf_sorcerer_exchange_skipped" &&
    !readAgentEventFact("readWolfSorcererSkipFact", event.type, event.payload, prepared)
  )
    return null;
  if (!queries.canView(event, actorId)) {
    return null;
  }
  if (prepared) event = prepared.projectionEvent;
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
    payload: projectPayload(event, queries, prepared),
  };
}

/** 保留既有公开字段及来源披露策略，排除内部元数据；用户原文不翻译、不改写。 */
function projectPayload(
  event: GameEvent,
  queries: AgentEventProjectionQueries,
  prepared?: PreparedAgentEvent,
): Record<string, unknown> {
  switch (event.type) {
    case "red_moon_night_sealed":
    case "red_moon_exile_delayed":
      return { actorId: event.payload.actorId, day: event.payload.day, night: event.payload.night };
    case "red_moon_delay_expired":
      return { actorId: event.payload.actorId, day: event.payload.day };
    case "magician_exchange_committed": {
      const fact = readAgentEventFact(
        "readMagicianExchangeFact",
        event.type,
        event.payload,
        prepared,
      );
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
      source: queries.projectAbilitySource(
        () => payload.source,
        () => payload.sourceDisclosed,
      ),
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

/** 支持既有 typed/trusted 布尔入口；不对未知对象承诺 hostile ingress 安全。 */
export function canViewAgentEvent(
  event: GameEvent,
  actorId: EntityId,
  queries: AgentEventVisibilityQueries,
): boolean {
  return canViewAgentEventWithFacts(event, actorId, queries);
}

/** 迁移准备阶段保留旧投影入口；生产 feed 切换后退出此无独立业务消费者的 API。 */
export function projectAgentEvent(
  event: GameEvent,
  actorId: EntityId,
  visibleSeq: number,
  queries: AgentEventProjectionQueries,
): PlayerVisibleEvent | null {
  return projectAgentEventWithFacts(event, actorId, visibleSeq, queries);
}

/** 授权取一次解析的事实；World 身份和自定义规则仍只在原分支按原时点查询。 */
export function canViewPreparedAgentEvent(
  prepared: PreparedAgentEvent,
  actorId: EntityId,
  queries: AgentEventVisibilityQueries,
): boolean {
  // 新入口的家族事实必须有效；旧 typed 布尔入口仍保留其原先较弱的校验范围。
  if (prepared.fact === null) return false;
  if (prepared.fact?.reader === "readMistRavenFact") {
    const event = prepared.projectionEvent;
    const audience = "audience" in event ? event.audience : null;
    if (
      !Array.isArray(audience) ||
      !audience.every((id) => Number.isSafeInteger(id) && id > 0) ||
      new Set(audience).size !== audience.length
    )
      return false;
  }
  return canViewAgentEventWithFacts(
    prepared.projectionEvent,
    actorId,
    {
      demonHunterActorId() {
        return queries.demonHunterActorId();
      },
      custom(_event, actorId) {
        return queries.custom(prepared.sourceEvent, actorId);
      },
    },
    prepared,
  );
}

export interface PreparedAgentEventProjectionQueries {
  canView(prepared: PreparedAgentEvent, actorId: EntityId): boolean;
  projectAbilitySource: AgentEventProjectionQueries["projectAbilitySource"];
}

/**
 * 事件流的唯一 canonical 投影入口。家族解析只在 prepare 执行一次，授权及字段裁剪复用该事实；
 * schema 回调修改原副本不改变已解析输出，无 schema 的可信来源回调仍在授权后按原顺序读取。
 */
export function projectPreparedAgentEvent(
  prepared: PreparedAgentEvent,
  actorId: EntityId,
  visibleSeq: number,
  queries: PreparedAgentEventProjectionQueries,
): PlayerVisibleEvent | null {
  return projectAgentEventWithFacts(
    prepared.projectionEvent,
    actorId,
    visibleSeq,
    {
      canView(_event, actorId) {
        return queries.canView(prepared, actorId);
      },
      projectAbilitySource(origin, disclosed) {
        return queries.projectAbilitySource(origin, disclosed);
      },
    },
    prepared,
  );
}
