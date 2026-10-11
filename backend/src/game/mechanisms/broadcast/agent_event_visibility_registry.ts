import {
  readModifierChoiceFact,
  readModifierSkipFact,
  readModifierBonusFact,
} from "@ai-werewolf-arena/game-text";
import { readTimeConsortChoiceFact, readTimeConsortSkipFact } from "@ai-werewolf-arena/game-text";
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
import { readMagicianExchangeFact, readDeathShotMissFact } from "@ai-werewolf-arena/game-text";
import { readNightmareFearFact } from "@ai-werewolf-arena/game-text";
import { demonHunterActorId } from "../roles/demon_hunter/authority";
import { GHOST_BRIDE_EVENT_TYPES } from "@ai-werewolf-arena/game-text";
/** 文件说明：领域事件到玩家 Agent 视角的显式可见性白名单。 */
import { EntityId, GameEvent, WOLF_TEAM_EVENT_TYPES } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";

type AgentEventVisibilityRule = (world: World, event: GameEvent, actorId: EntityId) => boolean;

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

const DEFAULT_RULES: Record<string, AgentEventVisibilityRule> = {};

/**
 * Agent 可见性注册表。
 *
 * 有意不提供“默认公开”：新增事件必须先明确受众才能进入玩家上下文。
 */
export class AgentEventVisibilityRegistry {
  constructor(private readonly rules: Record<string, AgentEventVisibilityRule> = DEFAULT_RULES) {}

  canView(world: World, event: GameEvent, actorId: EntityId): boolean {
    if (event.type === "modifier_conflict_resolved") return false;
    if (
      event.type === "modifier_choice_committed" ||
      event.type === "modifier_choice_skipped" ||
      event.type === "modifier_bonus_resolved"
    ) {
      const fact =
        readModifierChoiceFact(event.type, event.payload) ??
        readModifierSkipFact(event.type, event.payload) ??
        readModifierBonusFact(event.type, event.payload);
      return (
        !!fact &&
        Array.isArray(event.audience) &&
        event.audience.length === 1 &&
        event.audience[0] === actorId &&
        fact.actorId === actorId
      );
    }
    if (event.type === "time_consort_reflected") return false;
    if (
      event.type === "time_consort_lock_committed" ||
      event.type === "time_consort_lock_skipped"
    ) {
      const f =
        readTimeConsortChoiceFact(event.type, event.payload) ??
        readTimeConsortSkipFact(event.type, event.payload);
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
        readWolfSorcererExchangeFact(event.type, event.payload) ??
        readWolfSorcererSkipFact(event.type, event.payload);
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
        readTricksterExchangeFact(event.type, event.payload) ??
        readTricksterSkipFact(event.type, event.payload);
      return (
        !!f &&
        Array.isArray(event.audience) &&
        event.audience.length === 1 &&
        event.audience[0] === actorId &&
        f.actorId === actorId
      );
    }
    if (event.type === "exile_target_mapped")
      return !!readExileMappingFact(event.type, event.payload);
    if (event.type === "order_prince_choice_committed") {
      const fact = readOrderPrinceChoiceFact(event.type, event.payload);
      return (
        !!fact &&
        Array.isArray(event.audience) &&
        event.audience.length === 1 &&
        event.audience[0] === actorId &&
        fact.actorId === actorId
      );
    }
    if (event.type === "death_shot_missed")
      return !!readDeathShotMissFact(event.type, event.payload);
    if (event.type === "magician_exchange_committed") {
      const fact = readMagicianExchangeFact(event.type, event.payload);
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
        !!readNightmareFearFact(event.type, event.payload) &&
        Array.isArray(event.audience) &&
        event.audience.length === 1 &&
        event.audience[0] === actorId &&
        event.payload.actorId === actorId
      );

    if (
      WOLVES_ONLY_EVENT_TYPES.has(event.type) ||
      (GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(event.type)
    ) {
      // Missing historical authorization fails closed. Current identities never
      // grant access to past chat or revoke an event already addressed to a player.
      return "audience" in event && event.audience.includes(actorId);
    }
    if (
      ["demon_hunter_chosen", "demon_hunter_cancelled", "demon_hunter_poison_immune"].includes(
        event.type,
      )
    )
      return (
        event.type === "demon_hunter_chosen" &&
        demonHunterActorId(world) === actorId &&
        "audience" in event &&
        event.audience.length === 1 &&
        event.audience[0] === actorId &&
        event.payload.actorId === actorId
      );
    const custom = this.rules[event.type];
    if (custom) return custom(world, event, actorId);
    if (PUBLIC_EVENT_TYPES.has(event.type)) return true;
    if (ACTOR_ONLY_EVENT_TYPES.has(event.type) && "actorId" in event.payload) {
      return event.payload.actorId === actorId;
    }
    return false;
  }
}

let defaultRegistry: AgentEventVisibilityRegistry | null = null;

export function getDefaultAgentEventVisibilityRegistry(): AgentEventVisibilityRegistry {
  if (!defaultRegistry) defaultRegistry = new AgentEventVisibilityRegistry();
  return defaultRegistry;
}
