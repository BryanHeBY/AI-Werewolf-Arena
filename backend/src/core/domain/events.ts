import type { ActionWindow, Camp, EntityId, Phase, PotionType } from "./identity";
import type { InspectionResult, RoleId } from "@ai-werewolf-arena/game-catalog";
import type { GameResult } from "./results";

export interface EventBase<T extends string, P> {
  timestamp: number;
  type: T;
  payload: P;
}

export interface VoteRecord {
  actorId: EntityId;
  targetId: EntityId | null;
  abstain: boolean;
  weight: number;
  fallback?: boolean;
}

export interface SheriffVoteRecord {
  actorId: EntityId;
  targetId: EntityId | null;
  abstain: boolean;
}

export interface PrivatePlayerInfo {
  id: EntityId;
  seat: number;
  name: string;
  role: string;
  camp: string;
}

/** Internal snapshot of an actual exile, delivered only by the following night's role stage. */
export interface ExileFeedback {
  exileDay: number;
  targetId: EntityId;
  result: Extract<InspectionResult, { kind: "camp" }>;
}

export interface EventPayloadMap {
  death_ability_changed: { actorId: EntityId; abilityId: string; operation: "granted" | "armed" | "disabled" | "enabled" | "transferred_out"; grantedNight: number; armedOnNight: number | null; remaining: 0 | 1; disabled: boolean; deathExpired: boolean };
  ability_changed: {
    actorId: EntityId; abilityId: string; kind: "seer_check" | "role_check" | "guard" | "potion" | "dream";
    operation: "granted" | "disabled" | "enabled" | "transferred_out";
    source: { kind: "native"; role: string } | { kind: "gift"; actorId: EntityId } | { kind: "copy" | "transfer"; actorId: EntityId; abilityId: string };
    sourceDisclosed: boolean;
    startsOnDay: number; expiresAfterDay?: number; maxUses: number | null;
  };
  god_private_game_info: { boardSize: number; players: PrivatePlayerInfo[] };
  phase_changed: { phase: Phase; day: number; winner?: Camp | null; reason?: string; outcome?: GameResult["outcome"]; decidedAt?: GameResult["decidedAt"] };
  sheriff_elected: {
    winnerId: EntityId;
    source?: string;
    candidates?: EntityId[];
    tally?: Record<number, number>;
  };
  game_over: GameResult;
  night_resolved: { deaths: EntityId[] };
  bear_roared: { day:number; roared:boolean };
  hidden_wolf_awakened: {actorId:EntityId;day:number};
  gargoyle_awakened: {actorId:EntityId;day:number};
  mechanical_awakened: { actorId: EntityId; day: number; firstKnifeNight: number };
  awakened_inherited: { actorId: EntityId; day: number; firstKnifeNight: number };
  awakened_mimicked: { actorId: EntityId; day: number; targetId: EntityId; role: RoleId };
  awakened_mimic_skipped: { actorId: EntityId; day: number };
  awakened_ready: { actorId: EntityId; activationNight: number; activeFromNight: number; role: RoleId };
  awakened_skill_skipped: { actorId: EntityId; day: number };
  awakened_poison_used: { actorId: EntityId; day: number; targetId: EntityId };
  awakened_guard_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  awakened_attack_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  mechanical_mode_selected: { actorId: EntityId; day: number; mode: "kill" | "skill" };
  mechanical_mimicked: { actorId: EntityId; day: number; targetId: EntityId; role: RoleId; readyOnNight: number };
  mechanical_mimic_skipped: { actorId: EntityId; day: number };
  mechanical_skill_skipped: { actorId: EntityId; day: number };
  mechanical_poison_used: { actorId: EntityId; day: number; targetId: EntityId };
  mechanical_guard_chosen: { actorId: EntityId; day: number; targetId: EntityId | null; failed: boolean };
  mechanical_attack_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  mechanical_poison_reflected: { actorId: EntityId; day: number; protectedTargetId: EntityId; casterId: EntityId };
  mechanical_shot: { actorId: EntityId; targetId: EntityId };
  role_inspection_skipped: {actorId:EntityId;abilityId?:string;day:number;reason:"passed"|"no_targets"};
  lucky_ability_skipped: { actorId: EntityId; abilityId: string; day: number; kind: "seer_check" | "potion" | "guard" };
  hybrid_exemplar_chosen: { actorId: EntityId; day: number; targetId: EntityId };
  hybrid_affiliation_resolved: { actorId: EntityId; day: number; targetId: EntityId; faction: "good" | "wolf" };
  merchant_trade_committed: { actorId: EntityId; day: number; targetId: EntityId; skill: "check" | "poison" | "guard" };
  merchant_trade_skipped: { actorId: EntityId; day: number };
  merchant_trade_resolved: { actorId: EntityId; day: number; targetId: EntityId; skill: "check" | "poison" | "guard"; outcome: "granted" | "backlash" };
  role_inspected: {actorId:EntityId;abilityId?:string;targetId:EntityId;day:number;result:Extract<InspectionResult,{kind:"role"}>};
  wolf_self_destruct: { wolfId: EntityId; window: ActionWindow };
  white_wolf_king_self_destruct: { actorId: EntityId; targetId: EntityId | null; window: ActionWindow };
  knight_duel: { actorId: EntityId; targetId: EntityId; result: "wolf" | "not_wolf" };
  gravekeeper_reported: ExileFeedback & { actorId: EntityId; receivedDay: number };
  dream_applied: { actorId: EntityId; abilityId?: string; targetId: EntityId; day: number; consecutive: boolean };
  charm_applied: { actorId: EntityId; targetId: EntityId | null; day: number };
  charm_death: { actorId: EntityId; targetId: EntityId };
  charm_blocked: { actorId: EntityId; targetId: EntityId; reason: "night_protection" };
  dream_death: { actorId: EntityId; abilityId?: string; targetId: EntityId; day: number; reason: "consecutive" | "linked" };
  death_shot_blocked: { actorId: EntityId; targetId: EntityId; reason: "night_protection" };
  additional_deaths: { deaths: EntityId[] };
  day_speech: { actorId: EntityId; text: string };
  vote_cast: VoteRecord;
  vote_summary: { votes: VoteRecord[]; tally: Record<number, number>; target: EntityId | null };
  voted_out: { target: EntityId };
  last_words_granted: { playerId: EntityId; phase: Phase; day: number };
  last_words_spoken: { playerId: EntityId; phase: Phase; day: number; text: string };
  guard_applied: { actorId: EntityId; abilityId?: string; abstain: boolean; targetId: EntityId | null };
  seer_checked: { actorId: EntityId; abilityId?: string; targetId: EntityId; result: Extract<InspectionResult, { kind: "camp" }>; isWerewolf: boolean };
  hunter_silent_due_to_poison: { hunterId: EntityId };
  hunter_shot: { hunterId: EntityId; targetId: EntityId };
  /** Public gun fact without disclosing whether the skill was native or copied. */
  player_shot: { actorId: EntityId; targetId: EntityId };
  wolf_king_shot: { actorId: EntityId; targetId: EntityId };
  idiot_revealed: { targetId: EntityId };
  witch_potion_skipped: {
    actorId: EntityId;
    abilityId?: string;
    targetId: EntityId | null;
    potionType: PotionType;
    reason?: string;
  };
  witch_potion_used: { actorId: EntityId; abilityId?: string; targetId: EntityId; potionType: Exclude<PotionType, PotionType.None> };
  wolf_tactical_order: { order: EntityId[] };
  wolf_discussion_ended: { actorId: EntityId; reason: string; round: number };
  wolf_discussion: { actorId: EntityId; text: string; endChat: false; round: number };
  wolf_kill_vote_cast: { actorId: EntityId; abstain: boolean; targetId: EntityId | null; fallback?: boolean };
  sheriff_badge_destroyed: { targetId: EntityId; reason: string };
  sheriff_badge_transferred: { fromId: EntityId; toId: EntityId; reason: string };
  sheriff_vote_summary: { votes: SheriffVoteRecord[]; winnerId: EntityId | null };
  sheriff_candidate_declared: { actorId: EntityId; run: boolean };
  sheriff_nomination_summary: { candidates: EntityId[] };
  sheriff_withdraw_summary: { withdrawn: EntityId[] };
  sheriff_candidates_finalized: { candidates: EntityId[] };
  sheriff_vote_cast: SheriffVoteRecord;
  sheriff_direction_chosen: { sheriffId: EntityId; direction: "clockwise" | "counter_clockwise" };
}

export const WOLF_TEAM_EVENT_TYPES = ["wolf_tactical_order", "wolf_discussion", "wolf_discussion_ended", "wolf_kill_vote_cast"] as const;
export type WolfTeamEventType = typeof WOLF_TEAM_EVENT_TYPES[number];

export type GameEvent = {
  [K in keyof EventPayloadMap]: EventBase<K, EventPayloadMap[K]> &
    (K extends WolfTeamEventType ? { readonly audience: readonly EntityId[] } : {})
}[keyof EventPayloadMap];

/** Projected protocol; payload is intentionally open because projection/parsing is a wire boundary. */
export interface PlayerVisibleEvent {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
}
