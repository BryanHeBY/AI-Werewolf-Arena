import type {
  ActionWindow,
  KnightDuelWindow,
  Role,
  WinCondition,
  WitchSelfHealRule,
  TieBreakerStrategy,
} from "./identity";

export interface HookConfig {
  onDaybreak: boolean;
  onPreElection: boolean;
  onPreVote: boolean;
  onPerSpeechGap: boolean;
}

export interface SelfDestructConfig {
  enabledWindows: ActionWindow[];
}

export const SHERIFF_ELECTION_POLICIES = [
  "awa_final_candidates_v1",
  "awa_nomination_offstage_pk_v1",
] as const;
export type SheriffElectionPolicy = (typeof SHERIFF_ELECTION_POLICIES)[number];
export const EXILE_VOTE_POLICIES = ["awa_direct_v1", "awa_one_pk_v1"] as const;
export type ExileVotePolicy = (typeof EXILE_VOTE_POLICIES)[number];
export const SHERIFF_BADGE_POLICIES = ["awa_next_seat_v1", "awa_holder_choice_v1"] as const;
export type SheriffBadgePolicy = (typeof SHERIFF_BADGE_POLICIES)[number];
export interface SheriffConfig {
  badgePolicy?: SheriffBadgePolicy;
  electionPolicy?: SheriffElectionPolicy;
  voteWeight?: number;
}

export const WITCH_KNIFE_VISIBILITY_POLICIES = ["awa_with_heal_v1", "awa_always_v1"] as const;
export type WitchKnifeVisibilityPolicy = (typeof WITCH_KNIFE_VISIBILITY_POLICIES)[number];
export const WITCH_POTION_POLICIES = [
  "awa_one_native_v1",
  "awa_both_native_experimental_v1",
] as const;
export type WitchPotionPolicy = (typeof WITCH_POTION_POLICIES)[number];
export interface WitchConfig {
  knifeVisibility?: WitchKnifeVisibilityPolicy;
  potionPolicy?: WitchPotionPolicy;
  canSelfHeal?: WitchSelfHealRule;
}

export interface TieBreakerConfig {
  exileVote?: TieBreakerStrategy;
  wolfKillVote?: TieBreakerStrategy;
  sheriffVote?: TieBreakerStrategy;
}

export const GUARD_REPEAT_POLICIES = [
  "awa_last_action_v1",
  "netease_consecutive_nights_v1",
] as const;
export type GuardRepeatPolicy = (typeof GUARD_REPEAT_POLICIES)[number];

export const HIDDEN_WOLF_CAMP_INSPECTION_POLICIES = [
  "awa_inheritance_v1",
  "netease_2020_good_v1",
] as const;
export type HiddenWolfCampInspectionPolicy = (typeof HIDDEN_WOLF_CAMP_INSPECTION_POLICIES)[number];

export const SEER_TARGET_POLICIES = ["awa_alive_v1", "awa_fresh_others_v1"] as const;
export type SeerTargetPolicy = (typeof SEER_TARGET_POLICIES)[number];
export const SEER_ACTION_POLICIES = ["awa_optional_v1", "awa_required_when_legal_v1"] as const;
export type SeerActionPolicy = (typeof SEER_ACTION_POLICIES)[number];
/** Baseline NightPipeline requires a legal Seer action; all normalization paths share this value. */
export const DEFAULT_SEER_ACTION_POLICY: SeerActionPolicy = "awa_required_when_legal_v1";

export const DEATH_ACTION_POLICIES = ["awa_qualified_sources_v1", "awa_knife_or_exile_v1"] as const;
export type DeathActionPolicy = (typeof DEATH_ACTION_POLICIES)[number];
export const INSPECTION_POLICIES = [
  "awa_unique_required_v1",
  "awa_repeat_optional_v1",
  "awa_unique_optional_v1",
] as const;
export type InspectionPolicy = (typeof INSPECTION_POLICIES)[number];

export const DEATH_REVEAL_POLICIES = ["awa_hidden_v1", "netease_2017_open_v1"] as const;
export type DeathRevealPolicy = (typeof DEATH_REVEAL_POLICIES)[number];
export const LAST_WORDS_POLICIES = [
  "awa_initial_wave_v1",
  "netease_2017_day_and_first_night_v1",
] as const;
export type LastWordsPolicy = (typeof LAST_WORDS_POLICIES)[number];

export const DREAM_PROTECTION_POLICIES = [
  "awa_night_damage_v1",
  "netease_2026_night_immunity_v1",
] as const;
export type DreamProtectionPolicy = (typeof DREAM_PROTECTION_POLICIES)[number];
export const BEAUTY_DEATH_LINK_POLICIES = [
  "awa_exile_poison_v1",
  "heroes_s7_2017_exile_hunter_v1",
] as const;
export type BeautyDeathLinkPolicy = (typeof BEAUTY_DEATH_LINK_POLICIES)[number];

export const CUPID_POLICIES = [
  "netease_2017_cupid_follows_lovers_v1",
  "lui_meme_lovers_only_v1",
] as const;
export type CupidPolicy = (typeof CUPID_POLICIES)[number];

export interface BoardConfig {
  cupid?: { policy: CupidPolicy };
  dreamer?: { protectionPolicy: DreamProtectionPolicy };
  wolfBeauty?: { deathLinkPolicy: BeautyDeathLinkPolicy };
  disclosure?: { deathRevealPolicy: DeathRevealPolicy };
  lastWords?: { policy: LastWordsPolicy };
  boardSize: number;
  enableSheriff: boolean;
  initialSheriffSeat?: number;
  winConditions?: WinCondition[];
  winCondition?: WinCondition;
  hooks: HookConfig;
  selfDestruct?: SelfDestructConfig;
  sheriff?: SheriffConfig;
  witch?: WitchConfig;
  seer?: { targetPolicy: SeerTargetPolicy; actionPolicy: SeerActionPolicy };
  hunter?: { deathActionPolicy: DeathActionPolicy };
  wolfKing?: { deathActionPolicy: DeathActionPolicy };
  gargoyle?: { inspectionPolicy: InspectionPolicy };
  psychic?: { inspectionPolicy: InspectionPolicy };
  mirrorGirl?: { inspectionPolicy: InspectionPolicy };
  guard?: { repeatPolicy: GuardRepeatPolicy };
  hiddenWolf?: { campInspection: HiddenWolfCampInspectionPolicy };
  knight?: { enabledWindows: KnightDuelWindow[] };
  tieBreaker?: TieBreakerConfig;
  voting?: { exilePolicy: ExileVotePolicy };
  roleSetups: Array<{ role: Role; count: number }>;
}
