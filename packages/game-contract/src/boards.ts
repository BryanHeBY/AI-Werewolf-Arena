/**
 * 负责维护序列化板子结构及稳定政策数据。输入为身份与政策机器值，输出 BoardConfig 类型、原政策数组和默认常量。
 * 可选配置字段表示数据格式，并不证明组合已支持；本模块不发牌、不安装角色或授予行动许可，规则集与领域分别拥有这些行为。
 */
import { EVENT_PACK_IDS } from "./event-ids";
import type {
  CatSkippedVotePolicy,
  PufferBallotPolicy,
  BearSignalPolicy,
} from "./board-policy-identifiers";
import type {
  ActionWindow,
  KnightDuelWindow,
  Role,
  WinCondition,
  WitchSelfHealRule,
  TieBreakerStrategy,
} from "./identity";

/** 仅当双方淘汰目标同时达成时使用这份显式优先级。 */
export const ELIMINATION_PRIORITIES = ["awa_good_priority_v1", "awa_wolf_priority_v1"] as const;
export type EliminationPriority = (typeof ELIMINATION_PRIORITIES)[number];

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
/** 基础夜流程要求有合法目标时完成预言家行动；各规范化路径共用这一默认值。 */
export const DEFAULT_SEER_ACTION_POLICY: SeerActionPolicy = "awa_required_when_legal_v1";

export const DEATH_ACTION_POLICIES = ["awa_qualified_sources_v1", "awa_knife_or_exile_v1"] as const;
export type HunterDeathActionPolicy = (typeof DEATH_ACTION_POLICIES)[number];
export const WOLF_KING_DEATH_ACTION_POLICIES = [
  ...DEATH_ACTION_POLICIES,
  "awa_day_deaths_v1",
] as const;
export type DeathActionPolicy = (typeof WOLF_KING_DEATH_ACTION_POLICIES)[number];
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

export const DEBATER_POLICIES = ["awa_melbourne_2026_speech_gap_v1"] as const;
export type DebaterPolicy = (typeof DEBATER_POLICIES)[number];

export { EVENT_PACK_IDS } from "./event-ids";
// 可选字段保留“未提供”的序列化含义；这里不把省略字段改成有效运行配置。
/** 乌鸦只改变放逐开票；轮次与自选分歧必须显式配置，不从其它角色推导。 */
export interface CrowConfig {
  policy: "awa_netease_crow_v1";
  ballotPolicy: "initial_ballot_only" | "all_ballots";
  actionPolicy: "optional" | "required_when_legal";
  selfTarget: boolean;
}
export interface SilenceElderConfig {
  policy: "awa_melbourne_gestures_v1";
}
export interface BoardConfig {
  crow?: CrowConfig;
  silenceElder?: SilenceElderConfig;
  animalDream?: { policy: "awa_animal_dream_v1"; eliminationPriority: "awa_wolf_priority_v1" };
  whiteCat?: { skippedVotePolicy: CatSkippedVotePolicy };
  pufferfish?: { ballotPolicy: PufferBallotPolicy };
  bear?: { signalPolicy: BearSignalPolicy };
  fragrantPairSeer?: { policy: "awa_fragrant_pair_seer_v1" };
  nobleSecretBody?: { policy: "awa_noble_secret_body_v1" };
  nightNoble?: { wolfActionPolicy: "standard" | "no_blast_no_self_knife" };
  awakenedIdiot?: { protectionRepeatPolicy: "awa_nonconsecutive_nights_v1" | "awa_repeat_v1" };
  radiantEclipse?: { policy: "awa_radiant_eclipse_v1" };
  scholarMentor?: { policy: "awa_scholar_mentor_twelve_v1" };
  mistRaven?: { policy: "awa_mist_raven_v1" };
  timeConsort?: {
    policy: "awa_time_consort_reflection_v1";
    reflectionScope: "whole_night" | "first_effect";
  };
  wolfSorcerer?: { policy: "awa_wolf_sorcerer_seats_v1"; firstNight: 1 | 2 };
  trickster?: { policy: "awa_trickster_exile_v1" };
  orderPrince?: { policy: "awa_order_prince_first_ballot_v1" };
  magician?: {
    policy: "awa_magician_wolf_king_v1";
    firstNight: 1 | 2;
    deathShotTargetPolicy: "original" | "exchanged";
  };
  redMoon?: { policy: "awa_red_moon_demon_v1"; lastWolfBlastPolicy: "ends_game" | "forbidden" };
  nightmareShadow?: {
    policy: "awa_nightmare_dreamer_v1";
    fearActionPolicy: "optional" | "required_when_legal";
    wolfActionPolicy: "standard" | "no_blast_no_self_knife";
  };
  evilKnight?: {
    policy: "awa_evil_knight_v1";
    shotPolicy: "night_shot_immune" | "hunter_shot_bypasses";
  };
  pureWhite?: { policy: "awa_pure_white_night_v1"; eliminationPriority: EliminationPriority };
  wolfWitch?: { policy: "awa_pure_white_night_v1" };
  demonHunter?: { policy: "awa_netease_demon_hunter_v1" };
  events?: { pack: (typeof EVENT_PACK_IDS)[number] };
  wildChild?: { policy: "awa_lui_meme_wild_child_v1" };
  ghostBride?: { policy: "awa_melbourne_ghost_bride_v1" };
  lonelyGirl?: { policy: "awa_netease_lonely_girl_v1" };
  thief?: { policy: "lui_meme_thief_two_extra_villagers_v1" };
  shapeshifter?: { policy: "awa_netease_shapeshifter_two_extra_villagers_v1" };
  debater?: { policy: DebaterPolicy };
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
  hunter?: { deathActionPolicy: HunterDeathActionPolicy };
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
