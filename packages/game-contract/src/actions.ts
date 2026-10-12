/**
 * Responsibility: own serialized tool calls, validation results and turn data.
 * Input: contract identities and neutral message references; output: original
 * tool argument unions, ordered tool/stage IDs and optional constraint fields.
 * This data grants no action authorization and owns no Actor, World, resource
 * or transport lifecycle. Role selection and current-state checks remain domain.
 */
import { ActionWindow, KnightDuelWindow, type EntityId, type PotionType } from "./identity";
import type { MessageRef } from "./message-refs";
export interface ToolArgMap {
  fox_distract: { target_id: EntityId | null };
  puffer_retaliate: { activate: boolean };
  bind_fragrant_pair: { target_ids: readonly [EntityId, EntityId] | null };
  check_pair: { target_ids: readonly [EntityId, EntityId] };
  choose_servant: { target_id: EntityId | null };
  protect_secret_body: { target_id: EntityId | null };
  cast_shelter: { target_id: EntityId | null };
  swallow_skill: { target_id: EntityId | null };
  cast_mist: { target_ids: EntityId[] | null };
  use_snake: { target_id: EntityId | null };
  raven_knife: { target_id: EntityId | null };
  modify_skill: { mode: "enhance" | "weaken" | null; target_id: EntityId | null };
  bonus_action: {
    kind: "check" | "guard" | "poison" | "kill";
    target_id: EntityId | null;
    abstain: boolean;
  };
  lock_time: { target_id: EntityId | null; abstain: boolean };
  swap_night_seats: { first_id: EntityId | null; second_id: EntityId | null; abstain: boolean };
  swap_exile_targets: { first_id: EntityId | null; second_id: EntityId | null; abstain: boolean };
  reset_exile_vote: { activate: boolean };
  swap_targets: { first_id: EntityId | null; second_id: EntityId | null; abstain: boolean };
  fear: { target_id: EntityId | null; abstain: boolean };
  inspect_night_identity: { target_id: EntityId | null; abstain: boolean };
  demon_hunt: { target_id: EntityId | null; abstain: boolean };
  choose_bridegroom: { target_id: EntityId };
  choose_wedding_witness: { target_id: EntityId };
  speak_to_partner: { text: string };
  wedding_kill_vote: { target_id: EntityId | null; abstain: boolean };
  choose_wild_model: { target_id: EntityId };
  choose_thief_card: { slot: 0 | 1 };
  choose_shapeshifter_card: { slot: 0 | 1 };
  choose_admired_player: { target_id: number };
  write_note: { text: string };
  report_bug: {
    category: "flow" | "rule" | "state" | "logging" | "other";
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  };
  speak_to_wolves: { text: string; end_chat: boolean };
  kill_vote: { target_id: EntityId | null; abstain: boolean };
  guard: { target_id: EntityId | null; abstain: boolean };
  check_identity: { target_id: EntityId };
  inspect_role: { target_id: EntityId };
  mimic_role: { target_id: EntityId };
  awakened_mimic: { target_id: EntityId };
  awakened_poison: { target_id: EntityId };
  awakened_guard: { target_id: EntityId | null };
  awakened_attack: { target_id: EntityId | null };
  mechanical_mode: { mode: "kill" | "skill" };
  mechanical_inspect: { target_id: EntityId };
  mechanical_poison: { target_id: EntityId };
  mechanical_guard: { target_id: EntityId | null };
  mechanical_attack: { target_id: EntityId | null };
  choose_exemplar: { target_id: EntityId };
  choose_lovers: { first_id: EntityId; second_id: EntityId };
  challenge: { target_id: EntityId };
  debate_vote: { support: boolean | null };
  bestow_ability: { target_id: EntityId; skill: "check" | "poison" | "guard" };
  black_market_trade: { target_id: EntityId; skill: "check" | "poison" | "gun" };
  use_potion: { target_id: EntityId; potion_type: PotionType };
  self_destruct: { reason: string; confirm: boolean };
  self_destruct_with_target: { reason: string; confirm: boolean; target_id: EntityId | null };
  duel: { target_id: EntityId; confirm: boolean };
  dream: { target_id: EntityId };
  charm: { target_id: EntityId | null };
  speak: { text: string };
  vote: { target_id: EntityId | null; abstain: boolean };
  shoot: { target_id: EntityId | null };
  choose_badge_successor: { target_id: EntityId | null };
  choose_direction: { direction: "clockwise" | "counter_clockwise" };
  run_for_sheriff: { run: boolean };
  vote_for_sheriff: { target_id: EntityId | null; abstain: boolean };
}

export type ToolName = keyof ToolArgMap;
export const TOOL_NAMES = [
  "fox_distract",
  "puffer_retaliate",
  "bind_fragrant_pair",
  "check_pair",
  "choose_servant",
  "protect_secret_body",
  "cast_shelter",
  "swallow_skill",
  "cast_mist",
  "use_snake",
  "raven_knife",
  "modify_skill",
  "bonus_action",
  "lock_time",
  "swap_night_seats",
  "swap_exile_targets",
  "reset_exile_vote",
  "swap_targets",
  "fear",
  "inspect_night_identity",
  "demon_hunt",
  "choose_bridegroom",
  "choose_wedding_witness",
  "speak_to_partner",
  "wedding_kill_vote",
  "choose_wild_model",
  "choose_thief_card",
  "choose_shapeshifter_card",
  "choose_admired_player",
  "write_note",
  "report_bug",
  "speak_to_wolves",
  "kill_vote",
  "guard",
  "check_identity",
  "inspect_role",
  "mimic_role",
  "awakened_mimic",
  "awakened_poison",
  "awakened_guard",
  "awakened_attack",
  "mechanical_mode",
  "mechanical_inspect",
  "mechanical_poison",
  "mechanical_guard",
  "mechanical_attack",
  "bestow_ability",
  "black_market_trade",
  "choose_exemplar",
  "choose_lovers",
  "challenge",
  "debate_vote",
  "use_potion",
  "self_destruct",
  "self_destruct_with_target",
  "duel",
  "dream",
  "charm",
  "speak",
  "vote",
  "shoot",
  "choose_badge_successor",
  "choose_direction",
  "run_for_sheriff",
  "vote_for_sheriff",
] as const satisfies readonly ToolName[];
export type ToolCall = { [K in ToolName]: { name: K; args: ToolArgMap[K] } }[ToolName];
export type TypedToolCall<T extends ToolName> = Extract<ToolCall, { name: T }>;

export interface ToolValidationResult<T extends ToolCall = ToolCall> {
  ok: boolean;
  sanitizedCall?: T;
  /** Stable machine code, independent of locale. */
  error?: string;
  message?: string;
}

export interface TurnConstraints {
  min_valid_actions?: number;
  max_valid_actions?: number;
  required_any_tools?: ToolName[];
  /** Legacy/custom caller text is retained verbatim. */
  summary?: string;
  summary_message?: MessageRef;
}

export const ACTION_STAGES = [
  "fox_distract",
  "puffer_reaction",
  "fragrant_bind",
  "pair_inspection",
  "night_noble",
  "secret_body",
  "awakened_idiot_reveal_speech",
  "radiant_shelter",
  "eclipse_swallow",
  "alchemist_mist",
  "alchemist_snake",
  "raven_knife",
  "scholar_mentor_choice",
  "scholar_mentor_bonus",
  "time_consort_lock",
  "wolf_sorcerer_exchange",
  "trickster_exchange",
  "order_prince_choice",
  "order_prince_speech",
  "order_prince_revote",
  "magician_exchange",
  "nightmare_fear",
  "pure_white_girl",
  "wolf_witch",
  "demon_hunter",
  "ghost_bride_groom",
  "ghost_bride_chat",
  "ghost_bride_witness",
  "ghost_bride_knife",
  ...Object.values(ActionWindow),
  ...Object.values(KnightDuelWindow),
  "wolf_discussion",
  "wolf_vote",
  "guard",
  "seer",
  "role_inspection",
  "psychic",
  "mirror_girl",
  "lucky",
  "miracle_merchant",
  "black_market_merchant",
  "black_market_recipient",
  "hybrid",
  "cupid",
  "debate_challenge",
  "debate_speech",
  "debate_ballot",
  "wall_notes",
  "thief",
  "shapeshifter",
  "wild_child",
  "lonely_girl",
  "awakened_mimic",
  "awakened_skill",
  "awakened_attack",
  "mechanical_mode",
  "mechanical_mimic",
  "mechanical_skill",
  "mechanical_attack",
  "witch",
  "dreamer",
  "wolf_beauty",
  "day_speech",
  "voting",
  "hunter_shot",
  "death_shot",
  "last_words",
  "sheriff_nomination",
  "sheriff_campaign_speech",
  "sheriff_withdraw",
  "sheriff_vote",
  "sheriff_badge_choice",
  "sheriff_choose_direction",
  "sheriff_pk_speech",
  "sheriff_pk_vote",
  "exile_pk_speech",
  "exile_pk_vote",
] as const;
export type ActionStage = (typeof ACTION_STAGES)[number];
export const DEATH_SHOT_STAGES: readonly ActionStage[] = ["hunter_shot", "death_shot"];
