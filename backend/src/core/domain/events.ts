import type { ActionWindow, Camp, EntityId, Phase, PotionType } from "./identity";

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

export interface EventPayloadMap {
  god_private_game_info: { boardSize: number; players: PrivatePlayerInfo[] };
  phase_changed: { phase: Phase; day: number; winner?: Camp | null; reason?: string };
  sheriff_elected: {
    winnerId: EntityId;
    source?: string;
    candidates?: EntityId[];
    tally?: Record<number, number>;
  };
  game_over: { winner: Camp | null; reason: string };
  night_resolved: { deaths: EntityId[] };
  wolf_self_destruct: { wolfId: EntityId; window: ActionWindow };
  day_speech: { actorId: EntityId; text: string };
  vote_cast: VoteRecord;
  vote_summary: { votes: VoteRecord[]; tally: Record<number, number>; target: EntityId | null };
  voted_out: { target: EntityId };
  last_words_granted: { playerId: EntityId; phase: Phase; day: number };
  last_words_spoken: { playerId: EntityId; phase: Phase; day: number; text: string };
  guard_applied: { actorId: EntityId; abstain: boolean; targetId: EntityId | null };
  seer_checked: { actorId: EntityId; targetId: EntityId; isWerewolf: boolean };
  hunter_silent_due_to_poison: { hunterId: EntityId };
  hunter_shot: { hunterId: EntityId; targetId: EntityId };
  idiot_revealed: { targetId: EntityId };
  witch_potion_skipped: {
    actorId: EntityId;
    targetId: EntityId | null;
    potionType: PotionType;
    reason?: string;
  };
  witch_potion_used: { actorId: EntityId; targetId: EntityId; potionType: Exclude<PotionType, PotionType.None> };
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
