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
export interface SheriffConfig {
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

export interface BoardConfig {
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
  guard?: { repeatPolicy: GuardRepeatPolicy };
  hiddenWolf?: { campInspection: HiddenWolfCampInspectionPolicy };
  knight?: { enabledWindows: KnightDuelWindow[] };
  tieBreaker?: TieBreakerConfig;
  voting?: { exilePolicy: ExileVotePolicy };
  roleSetups: Array<{ role: Role; count: number }>;
}
