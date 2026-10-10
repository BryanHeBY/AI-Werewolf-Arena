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
import {
  readMagicianExchangeFact,
  readMagicianOwnExchangeFact,
  readDeathShotMissFact,
} from "@ai-werewolf-arena/game-text";
import { readRedMoonNextNightFact, readRedMoonExpiryFact } from "@ai-werewolf-arena/game-text";
import { readNightmareFearFact, readNightmareOwnFearFact } from "@ai-werewolf-arena/game-text";
import {
  DEMON_HUNTER_EVENT_TYPES,
  readDemonHunterEventFact,
  readDemonHunterPlayerFact,
} from "@ai-werewolf-arena/game-text";
import { GHOST_BRIDE_EVENT_TYPES, readGhostBrideEventFact } from "@ai-werewolf-arena/game-text";
import { readLonelyGirlEventFact } from "@ai-werewolf-arena/game-text";
import {
  WILD_CHILD_EVENT_TYPES,
  readWildChildEventFact,
  readWildChildPlayerFact,
} from "@ai-werewolf-arena/game-text";
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
import {
  readGravekeeperFeedback,
  readInspectionResult,
  readVictoryResult,
  type ReplayEvent,
} from "@ai-werewolf-arena/replay-contract";
import { isRoleId, type RoleId, type SealedVictoryResult } from "@ai-werewolf-arena/game-catalog";

export type ReplayEffect =
  | { kind: "camp_changed"; playerId: number; camp: "wolf" }
  | { kind: "identity_changed"; playerId: number; role: RoleId; camp: string }
  | { kind: "role_revealed"; playerId: number; role: RoleId }
  | { kind: "deaths"; playerIds: number[] }
  | { kind: "sheriff_elected"; playerId: number }
  | { kind: "sheriff_transferred"; fromId: number; toId: number }
  | { kind: "sheriff_destroyed"; playerId: number }
  | { kind: "victory"; decision: SealedVictoryResult };
export interface ReadReplayEvent {
  event: ReplayEvent;
  relatedPlayerIds: number[];
  effects: ReplayEffect[];
}

// Required references are event-specific. Unknown extension fields never imply player membership.
const REQUIRED_IDS: Readonly<Record<string, string[]>> = {
  red_moon_night_sealed: ["actorId"],
  red_moon_exile_delayed: ["actorId"],
  red_moon_delay_expired: ["actorId"],
  nightmare_fear_committed: [],
  demon_hunter_chosen: [],
  demon_hunter_cancelled: ["actorId", "targetId"],
  demon_hunter_poison_immune: ["actorId", "witchId"],
  ghost_bride_pair_chosen: ["brideId", "groomId"],
  ghost_bride_group_chosen: ["brideId", "groomId", "witnessId"],
  ghost_bride_witness_vote: ["actorId", "targetId"],
  ghost_bride_partner_chat: ["actorId", "recipientId"],
  ghost_bride_knife_vote: ["actorId"],
  ghost_bride_partner_death: ["actorId", "targetId"],
  lonely_girl_admired_chosen: ["actorId", "targetId"],
  wild_child_model_chosen: ["actorId", "targetId"],
  wild_child_model_eliminated: ["actorId", "targetId"],
  wild_child_transformed: ["actorId"],
  wild_child_pack_activated: ["actorId"],
  thief_identity_chosen: ["actorId"],
  shapeshifter_identity_chosen: ["actorId"],
  wall_note_changed: ["actorId"],
  debater_revealed: ["actorId"],
  debate_started: ["actorId", "targetId"],
  debate_speech: ["actorId"],
  debate_resolved: ["actorId", "targetId", "blockedId"],
  debate_canceled: ["actorId", "targetId"],
  debate_ballots_recorded: ["actorId", "targetId"],
  player_role_revealed: ["playerId"],
  ability_changed: ["actorId"],
  death_ability_changed: ["actorId"],
  lucky_ability_skipped: ["actorId"],
  gargoyle_awakened: ["actorId"],
  hidden_wolf_awakened: ["actorId"],
  role_inspection_skipped: ["actorId"],
  role_inspected: ["actorId", "targetId"],
  seer_checked: ["actorId", "targetId"],
  charm_applied: ["actorId"],
  charm_death: ["actorId", "targetId"],
  charm_blocked: ["actorId", "targetId"],
  dream_applied: ["actorId", "targetId"],
  dream_death: ["actorId", "targetId"],
  death_shot_blocked: ["actorId", "targetId"],
  gravekeeper_reported: ["actorId", "targetId"],
  wolf_discussion: ["actorId"],
  wolf_discussion_ended: ["actorId"],
  wolf_kill_vote_cast: ["actorId"],
  guard_applied: ["actorId"],
  witch_potion_used: ["actorId", "targetId"],
  witch_potion_skipped: ["actorId"],
  sheriff_candidate_declared: ["actorId"],
  sheriff_vote_cast: ["actorId"],
  vote_cast: ["actorId"],
  sheriff_elected: ["winnerId"],
  sheriff_direction_chosen: ["sheriffId"],
  sheriff_badge_transferred: ["fromId", "toId"],
  sheriff_badge_destroyed: ["targetId"],
  day_speech: ["actorId"],
  voted_out: ["target"],
  idiot_revealed: ["targetId"],
  wolf_self_destruct: ["wolfId"],
  white_wolf_king_self_destruct: ["actorId"],
  knight_duel: ["actorId", "targetId"],
  hunter_shot: ["hunterId", "targetId"],
  player_shot: ["actorId", "targetId"],
  wolf_king_shot: ["actorId", "targetId"],
  hunter_silent_due_to_poison: ["hunterId"],
  last_words_granted: ["playerId"],
  last_words_spoken: ["playerId"],
  mechanical_awakened: ["actorId"],
  mechanical_mode_selected: ["actorId"],
  mechanical_mimicked: ["actorId", "targetId"],
  mechanical_mimic_skipped: ["actorId"],
  mechanical_skill_skipped: ["actorId"],
  mechanical_poison_used: ["actorId", "targetId"],
  mechanical_guard_chosen: ["actorId"],
  mechanical_attack_chosen: ["actorId"],
  mechanical_poison_reflected: ["actorId", "protectedTargetId", "casterId"],
  mechanical_shot: ["actorId", "targetId"],
  awakened_inherited: ["actorId"],
  awakened_mimicked: ["actorId", "targetId"],
  awakened_mimic_skipped: ["actorId"],
  awakened_ready: ["actorId"],
  awakened_skill_skipped: ["actorId"],
  awakened_poison_used: ["actorId", "targetId"],
  awakened_guard_chosen: ["actorId"],
  awakened_attack_chosen: ["actorId"],
  cupid_lovers_chosen: ["actorId"],
  cupid_relation_resolved: ["actorId"],
  lover_recognized: ["actorId", "partnerId"],
  lovers_death: ["actorId", "targetId"],
  hybrid_exemplar_chosen: ["actorId", "targetId"],
  hybrid_affiliation_resolved: ["actorId", "targetId"],
  merchant_trade_committed: ["actorId", "targetId"],
  merchant_trade_resolved: ["actorId", "targetId"],
  merchant_trade_skipped: ["actorId"],
  black_market_trade_committed: ["actorId", "targetId"],
  black_market_trade_resolved: ["actorId", "targetId"],
  black_market_trade_skipped: ["actorId"],
};
const ID_LISTS: Readonly<Record<string, string>> = {
  ghost_bride_knife_captured: "actorIds",
  ghost_bride_knife_resolved: "actorIds",
  cupid_lovers_chosen: "pairIds",
  cupid_relation_resolved: "pairIds",
  night_resolved: "deaths",
  additional_deaths: "deaths",
  wolf_tactical_order: "order",
  sheriff_nomination_summary: "candidates",
  sheriff_pk_started: "candidates",
  exile_pk_started: "candidates",
  sheriff_candidates_finalized: "candidates",
  sheriff_withdraw_summary: "withdrawn",
};
const NULLABLE_TARGETS = new Set([
  "nightmare_fear_committed",
  "demon_hunter_chosen",
  "ghost_bride_knife_vote",
  "ghost_bride_knife_resolved",
  "charm_applied",
  "white_wolf_king_self_destruct",
  "mechanical_guard_chosen",
  "mechanical_attack_chosen",
  "awakened_guard_chosen",
  "awakened_attack_chosen",
]);
const VOTES = new Set(["wolf_kill_vote_cast", "guard_applied", "sheriff_vote_cast", "vote_cast"]);
const SUMMARIES = new Set(["sheriff_vote_summary", "vote_summary"]);
const NO_IDS = new Set([
  "thief_initial_deal",
  "shapeshifter_initial_deal",
  "wall_notes_started",
  "wall_notes_published",
  "wall_notes_canceled",
  "wall_note_order_recorded",
  "phase_changed",
  "bear_roared",
  "game_over",
  "god_private_game_info",
]);
export const KNOWN_REPLAY_EVENT_TYPES = Object.freeze([
  "wolf_sorcerer_exchange_committed",
  "wolf_sorcerer_exchange_skipped",
  "trickster_exchange_committed",
  "trickster_exchange_skipped",
  "exile_target_mapped",
  "order_prince_choice_committed",
  "order_prince_revote_started",
  "magician_exchange_committed",
  "death_shot_missed",
  ...new Set([...Object.keys(REQUIRED_IDS), ...Object.keys(ID_LISTS), ...SUMMARIES, ...NO_IDS]),
]);
const KNOWN = new Set(KNOWN_REPLAY_EVENT_TYPES);

// Read only plain JSON data descriptors. Accessors, cycles, sparse arrays and non-JSON values
// fail before any label, association or state effect uses a payload field.
function copyJson(value: unknown, ancestors = new Set<object>(), depth = 0): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object" || depth > 64 || ancestors.has(value))
    throw new Error("replay_event_not_json");
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    throw new Error("replay_event_not_plain");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length) throw new Error("replay_event_symbol");
  ancestors.add(value);
  try {
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value"))
        throw new Error("replay_event_accessor");
      // The TypeScript envelope permits an explicitly undefined optional stage.
      // Disk JSON omits that field; payload values must still be strict JSON.
      if (depth === 0 && key === "stage" && descriptor.value === undefined) continue;
      result[key] = copyJson(descriptor.value, ancestors, depth + 1);
    }
    if (!array) return result;
    const length = descriptors.length?.value;
    if (!Number.isSafeInteger(length) || Object.keys(result).length !== length)
      throw new Error("replay_event_sparse_array");
    return Array.from({ length }, (_, index) => {
      if (!Object.hasOwn(result, String(index))) throw new Error("replay_event_array_key");
      return result[String(index)];
    });
  } finally {
    ancestors.delete(value);
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validKnownFields(type: string, p: Record<string, unknown>): boolean {
  if (type === "wolf_sorcerer_exchange_committed") return !!readWolfSorcererExchangeFact(type, p);
  if (type === "wolf_sorcerer_exchange_skipped") return !!readWolfSorcererSkipFact(type, p);
  if (type === "trickster_exchange_committed") return !!readTricksterExchangeFact(type, p);
  if (type === "trickster_exchange_skipped") return !!readTricksterSkipFact(type, p);
  if (type === "exile_target_mapped") return !!readExileMappingFact(type, p);
  if (type === "order_prince_choice_committed") return !!readOrderPrinceChoiceFact(type, p);
  if (type === "order_prince_revote_started") return !!readOrderPrinceRevoteFact(type, p);
  if (type === "magician_exchange_committed")
    return !!(readMagicianExchangeFact(type, p) ?? readMagicianOwnExchangeFact(type, p));
  if (type === "death_shot_missed") return !!readDeathShotMissFact(type, p);
  if (type === "red_moon_night_sealed" || type === "red_moon_exile_delayed")
    return !!readRedMoonNextNightFact(type, p);
  if (type === "red_moon_delay_expired") return !!readRedMoonExpiryFact(type, p);
  if (type === "nightmare_fear_committed")
    return !!(readNightmareFearFact(type, p) ?? readNightmareOwnFearFact(type, p));
  if ((DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(type))
    return !!(readDemonHunterEventFact(type, p) ?? readDemonHunterPlayerFact(type, p));
  if ((GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(type))
    return !!readGhostBrideEventFact(type, p);
  if ((WILD_CHILD_EVENT_TYPES as readonly string[]).includes(type))
    return !!(readWildChildEventFact(type, p) ?? readWildChildPlayerFact(type, p));
  if (type === "lonely_girl_admired_chosen") return !!readLonelyGirlEventFact(type, p);
  if ((SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(type))
    return !!readShapeshifterEventFact(type, p);
  if ((THIEF_EVENT_TYPES as readonly string[]).includes(type)) return !!readThiefEventFact(type, p);
  if ((WALL_EVENT_TYPES as readonly string[]).includes(type))
    return readWallEventFact(type, p) !== null;
  if ((DEBATE_EVENT_TYPES as readonly string[]).includes(type))
    return readDebateEventFact(type, p) !== null;
  if ((CUPID_EVENT_TYPES as readonly string[]).includes(type))
    return readCupidEventFact(type, p) !== null;
  if (type === "player_role_revealed")
    return isRoleId(p.role) && Object.keys(p).every((key) => key === "playerId" || key === "role");
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const strings: Readonly<Record<string, string[]>> = {
    ability_changed: ["abilityId", "kind", "operation"],
    lucky_ability_skipped: ["abilityId", "kind"],
    wolf_discussion: ["text"],
    wolf_discussion_ended: ["reason"],
    day_speech: ["text"],
    last_words_spoken: ["text"],
    sheriff_direction_chosen: ["direction"],
    witch_potion_used: ["potionType"],
  };
  if ((strings[type] ?? []).some((key) => typeof p[key] !== "string")) return false;
  if (p.day !== undefined && !positive(p.day)) return false;
  if (type === "sheriff_candidate_declared" && typeof p.run !== "boolean") return false;
  if (type === "role_inspection_skipped" && p.reason !== "passed" && p.reason !== "no_targets")
    return false;
  if (type === "seer_checked" && p.isWerewolf !== undefined && typeof p.isWerewolf !== "boolean")
    return false;
  if (type.startsWith("mechanical_") || type.startsWith("awakened_")) {
    if (type !== "mechanical_shot" && type !== "awakened_ready" && !positive(p.day)) return false;
    if (type.endsWith("_awakened") || type === "awakened_inherited")
      return positive(p.firstKnifeNight);
    if (type === "mechanical_mode_selected") return p.mode === "kill" || p.mode === "skill";
    if (type.endsWith("_mimicked"))
      return (
        isRoleId(p.role) &&
        (type !== "mechanical_mimicked" || positive(p.readyOnNight)) &&
        (type !== "awakened_mimicked" || p.targetId !== p.actorId)
      );
    if (type === "awakened_ready")
      return (
        positive(p.activationNight) &&
        p.activeFromNight === p.activationNight + 1 &&
        isRoleId(p.role)
      );
    if (type === "mechanical_guard_chosen") return typeof p.failed === "boolean";
  }
  if (type.startsWith("hybrid_"))
    return (
      p.day === 1 &&
      p.actorId !== p.targetId &&
      Object.keys(p).every((key) =>
        [
          "actorId",
          "targetId",
          "day",
          ...(type === "hybrid_affiliation_resolved" ? ["faction"] : []),
        ].includes(key),
      ) &&
      (type !== "hybrid_affiliation_resolved" || p.faction === "wolf" || p.faction === "good")
    );
  if (type.startsWith("merchant_trade_") || type.startsWith("black_market_trade_")) {
    if (!positive(p.day)) return false;
    if (type.endsWith("_skipped")) return true;
    const black = type.startsWith("black_market_");
    return (
      (!black || p.actorId !== p.targetId) &&
      (black ? ["check", "poison", "gun"] : ["check", "poison", "guard"]).includes(
        p.skill as string,
      ) &&
      (!type.endsWith("_resolved") || p.outcome === "granted" || p.outcome === "backlash")
    );
  }
  if (type === "death_ability_changed") {
    if (
      typeof p.abilityId !== "string" ||
      !/^[a-z][a-z0-9:_-]{0,127}$/.test(p.abilityId) ||
      p.abilityId.startsWith("native:") ||
      !positive(p.grantedNight) ||
      !(
        p.armedOnNight === null ||
        (positive(p.armedOnNight) && p.armedOnNight >= p.grantedNight)
      ) ||
      ![0, 1].includes(p.remaining as number) ||
      typeof p.disabled !== "boolean" ||
      typeof p.deathExpired !== "boolean" ||
      !["granted", "armed", "disabled", "enabled", "transferred_out"].includes(
        p.operation as string,
      )
    )
      return false;
    return !(
      (p.operation === "armed" &&
        (p.armedOnNight === null || p.disabled || p.deathExpired || p.remaining !== 1)) ||
      (p.operation === "disabled" && !p.disabled) ||
      (p.operation === "enabled" && (p.disabled || p.deathExpired)) ||
      (p.deathExpired && (!p.disabled || p.remaining !== 0))
    );
  }
  return true;
}

/** Read a detached, inert envelope for neutral display of malformed event facts. */
export function readReplayEventEnvelope(event: ReplayEvent): ReplayEvent | null {
  try {
    const safe = copyJson(event) as ReplayEvent;
    if (
      !record(safe.payload) ||
      typeof safe.type !== "string" ||
      !Number.isSafeInteger(safe.seq) ||
      safe.seq < 1 ||
      !Number.isSafeInteger(safe.day) ||
      safe.day < 0 ||
      typeof safe.phase !== "string" ||
      typeof safe.timestamp !== "string" ||
      (safe.stage !== undefined && typeof safe.stage !== "string")
    )
      return null;
    return safe;
  } catch {
    return null;
  }
}

/** Raw archives remain permissive; malformed known facts have no partial display/state effects. */
export function readReplayEvent(
  event: ReplayEvent,
  knownPlayerIds?: readonly number[],
): ReadReplayEvent | null {
  try {
    const safe = readReplayEventEnvelope(event);
    if (!safe) return null;
    const p = safe.payload;
    if (
      ["red_moon_night_sealed", "red_moon_exile_delayed", "red_moon_delay_expired"].includes(
        safe.type,
      )
    ) {
      if (p.day !== safe.day) return null;
      if (
        safe.type === "red_moon_delay_expired"
          ? safe.phase !== "night"
          : safe.type === "red_moon_exile_delayed"
            ? safe.phase !== "voting"
            : !["day", "voting"].includes(safe.phase)
      )
        return null;
    }
    const related = new Set<number>();
    const id = (value: unknown): value is number =>
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value > 0 &&
      (!knownPlayerIds || knownPlayerIds.includes(value));
    const add = (value: unknown, nullable = false) => {
      if (nullable && value === null) return;
      if (!id(value)) throw new Error("replay_event_player_id");
      related.add(value);
    };
    const list = (value: unknown) => {
      if (!Array.isArray(value)) throw new Error("replay_event_player_list");
      for (const item of value) add(item);
    };
    const vote = (row: unknown) => {
      if (!record(row)) throw new Error("replay_event_vote");
      add(row.actorId);
      if (row.abstain !== undefined && typeof row.abstain !== "boolean")
        throw new Error("replay_event_abstain");
      if (row.abstain === true) {
        if (row.targetId !== undefined) add(row.targetId, true);
      } else add(row.targetId, row.targetId === null);
      if (row.weight !== undefined && (typeof row.weight !== "number" || row.weight < 0))
        throw new Error("replay_event_weight");
    };
    if (!KNOWN.has(safe.type)) return { event: safe, relatedPlayerIds: [], effects: [] };
    if (!validKnownFields(safe.type, p)) return null;
    if (safe.type === "magician_exchange_committed") {
      if (p.day !== safe.day || safe.phase !== "night") return null;
      if (Object.hasOwn(p, "actorId")) add(p.actorId);
      if (p.pair !== null) list(p.pair);
    }
    if (safe.type === "death_shot_missed") add(p.actorId);
    if (
      safe.type === "wolf_sorcerer_exchange_committed" ||
      safe.type === "wolf_sorcerer_exchange_skipped"
    ) {
      if (safe.phase !== "night" || p.day !== safe.day) return null;
      add(p.actorId);
      if (Array.isArray(p.pair)) for (const id of p.pair) add(id);
    }
    if (
      safe.type === "trickster_exchange_committed" ||
      safe.type === "trickster_exchange_skipped"
    ) {
      if (safe.phase !== "night" || p.day !== safe.day) return null;
      add(p.actorId);
      if (Array.isArray(p.pair)) for (const id of p.pair) add(id);
    }
    if (safe.type === "exile_target_mapped") {
      if (safe.phase !== "voting") return null;
      add(p.requestedId);
      add(p.effectiveId);
    }
    if (safe.type === "order_prince_choice_committed") {
      if (safe.phase !== "voting" || p.day !== safe.day) return null;
      add(p.actorId);
    }
    if (safe.type === "order_prince_revote_started") {
      if (safe.phase !== "voting") return null;
      add(p.actorId);
    }
    if (safe.type === "nightmare_fear_committed") {
      if (p.day !== safe.day || safe.phase !== "night") return null;
      if (Object.hasOwn(p, "actorId")) add(p.actorId);
    }
    if ((DEMON_HUNTER_EVENT_TYPES as readonly string[]).includes(safe.type)) {
      if (p.day !== safe.day || safe.phase !== "night") return null;
      if (safe.type === "demon_hunter_chosen" && Object.hasOwn(p, "actorId")) add(p.actorId);
    }
    if (safe.type === "lonely_girl_admired_chosen" && (safe.day !== 1 || safe.phase !== "night"))
      return null;
    if ((GHOST_BRIDE_EVENT_TYPES as readonly string[]).includes(safe.type)) {
      if (
        p.day !== safe.day ||
        (safe.type === "ghost_bride_partner_death"
          ? p.phase !== safe.phase
          : safe.phase !== "night")
      )
        return null;
      if (
        [
          "ghost_bride_pair_chosen",
          "ghost_bride_group_chosen",
          "ghost_bride_witness_vote",
        ].includes(safe.type) &&
        safe.day !== 1
      )
        return null;
    }
    for (const key of REQUIRED_IDS[safe.type] ?? []) add(p[key]);
    if (safe.type === "wall_note_order_recorded")
      for (const row of p.rows as Array<{ actorId: number }>) add(row.actorId);
    if (safe.type === "debate_ballots_recorded")
      for (const ballot of p.ballots as Array<{ voterId: number }>) add(ballot.voterId);
    if (NULLABLE_TARGETS.has(safe.type)) add(p.targetId, true);
    if (ID_LISTS[safe.type]) list(p[ID_LISTS[safe.type]!]);
    if (VOTES.has(safe.type)) vote(p);
    if (SUMMARIES.has(safe.type)) {
      if (!Array.isArray(p.votes)) return null;
      for (const row of p.votes) vote(row);
      if (Object.hasOwn(p, "winnerId")) add(p.winnerId, true);
      if (Object.hasOwn(p, "target")) add(p.target, true);
    }
    if (safe.type === "sheriff_elected" && Object.hasOwn(p, "candidates")) list(p.candidates);
    if (safe.type === "witch_potion_skipped" && Object.hasOwn(p, "targetId")) add(p.targetId, true);
    if (safe.type === "ability_changed" && record(p.source) && Object.hasOwn(p.source, "actorId"))
      add(p.source.actorId);
    if (safe.type === "god_private_game_info") {
      if (!Array.isArray(p.players)) return null;
      for (const player of p.players) {
        if (!record(player) || typeof player.role !== "string") return null;
        add(player.id ?? player.seat);
      }
    }
    if (safe.type === "gravekeeper_reported" && !readGravekeeperFeedback(p)) return null;
    if (safe.type === "role_inspected" && readInspectionResult(p.result)?.kind !== "role")
      return null;
    if (
      ["charm_blocked", "death_shot_blocked"].includes(safe.type) &&
      p.reason !== "night_protection"
    )
      return null;
    if (safe.type === "dream_death" && p.reason !== "consecutive" && p.reason !== "linked")
      return null;
    if (safe.type === "dream_applied" && typeof p.consecutive !== "boolean") return null;
    if (safe.type === "bear_roared" && typeof p.roared !== "boolean") return null;
    if (safe.type === "knight_duel" && p.result !== "wolf" && p.result !== "not_wolf") return null;
    if (safe.type === "phase_changed" && typeof p.phase !== "string") return null;
    const effects: ReplayEffect[] = [];
    if (safe.type === "wild_child_transformed") {
      if (p.day !== safe.day) return null;
      effects.push({ kind: "camp_changed", playerId: p.actorId as number, camp: "wolf" });
    }
    if (safe.type === "wild_child_model_chosen" && (safe.day !== 1 || safe.phase !== "night"))
      return null;
    if (safe.type === "wild_child_pack_activated" && (p.day !== safe.day || safe.phase !== "night"))
      return null;
    if (
      (safe.type === "thief_identity_chosen" || safe.type === "shapeshifter_identity_chosen") &&
      isRoleId(p.role)
    ) {
      if (safe.day !== 1 || safe.phase !== "night") return null;
      effects.push({
        kind: "identity_changed",
        playerId: p.actorId as number,
        role: p.role,
        camp: p.camp as string,
      });
    }
    if (safe.type === "order_prince_revote_started")
      effects.push({ kind: "role_revealed", playerId: p.actorId as number, role: "order_prince" });
    if (safe.type === "debater_revealed")
      effects.push({ kind: "role_revealed", playerId: p.actorId as number, role: "debater" });
    if (safe.type === "player_role_revealed" && isRoleId(p.role)) {
      effects.push({ kind: "role_revealed", playerId: p.playerId as number, role: p.role });
      effects.push({ kind: "deaths", playerIds: [p.playerId as number] });
    }
    if (safe.type === "game_over") {
      if (Object.hasOwn(p, "outcome") || Object.hasOwn(p, "decidedAt")) {
        const decision = readVictoryResult(p, knownPlayerIds);
        if (decision.outcome.kind === "victory") list(decision.outcome.winningPlayerIds);
        effects.push({ kind: "victory", decision });
      } else if (
        !Object.hasOwn(p, "winner") ||
        (p.winner !== null && typeof p.winner !== "string") ||
        (p.reason !== undefined && p.reason !== null && typeof p.reason !== "string")
      )
        return null;
    }
    if (safe.type === "red_moon_night_sealed" || safe.type === "red_moon_exile_delayed")
      effects.push({
        kind: "role_revealed",
        playerId: p.actorId as number,
        role: "red_moon_apostle",
      });
    const dead: number[] = [];
    if (safe.type === "red_moon_delay_expired") dead.push(p.actorId as number);
    if (safe.type === "night_resolved" || safe.type === "additional_deaths")
      dead.push(...(p.deaths as number[]));
    if (safe.type === "voted_out") dead.push(p.target as number);
    if (
      safe.type === "lovers_death" ||
      safe.type === "charm_death" ||
      safe.type === "dream_death" ||
      ["hunter_shot", "player_shot", "wolf_king_shot", "mechanical_shot"].includes(safe.type)
    )
      dead.push(p.targetId as number);
    if (safe.type === "wolf_self_destruct") dead.push(p.wolfId as number);
    if (safe.type === "white_wolf_king_self_destruct") {
      dead.push(p.actorId as number);
      if (p.targetId !== null) dead.push(p.targetId as number);
    }
    if (safe.type === "knight_duel")
      dead.push((p.result === "wolf" ? p.targetId : p.actorId) as number);
    if (dead.length) effects.push({ kind: "deaths", playerIds: dead });
    if (safe.type === "sheriff_elected")
      effects.push({ kind: "sheriff_elected", playerId: p.winnerId as number });
    if (safe.type === "sheriff_badge_transferred")
      effects.push({
        kind: "sheriff_transferred",
        fromId: p.fromId as number,
        toId: p.toId as number,
      });
    if (safe.type === "sheriff_badge_destroyed")
      effects.push({ kind: "sheriff_destroyed", playerId: p.targetId as number });
    return { event: safe, relatedPlayerIds: [...related].sort((a, b) => a - b), effects };
  } catch {
    return null;
  }
}
export function replayEventPlayerIds(
  event: ReplayEvent,
  knownPlayerIds?: readonly number[],
): number[] {
  return readReplayEvent(event, knownPlayerIds)?.relatedPlayerIds ?? [];
}

/** Classification only: inspect a data descriptor without evaluating an accessor. */
export function readReplayEventType(event: ReplayEvent): string | null {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(event, "type");
    return descriptor?.enumerable && "value" in descriptor && typeof descriptor.value === "string"
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}
