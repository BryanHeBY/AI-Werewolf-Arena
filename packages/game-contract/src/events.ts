/**
 * 负责领域事实和玩家可见事件的纯数据契约；输入为身份、结果与各族 payload 声明，
 * 输出为原判别事件映射、指定事实的历史 audience 以及玩家事件序号形状。
 * 声明不定义组件句柄、scope、回调或运行许可；数据读器、事实发表与玩家投影各持原验证／裁剪职责。
 * 历史事实不执行规则、不恢复库存或授权行动；类型声明不代替未知数据解析、复制或深冻结。
 */
import type { NobleSecretBodyPayloadMap } from "./facts/noble-secret-body";
import type { AnimalDreamPayloadMap } from "./facts/animal-dream";
import type { FragrantPairPayloadMap } from "./facts/fragrant-pair-seer";
import type { RedMoonNextNightFact, RedMoonExpiryFact } from "./facts/red-moon";
import type {
  DemonHunterChoiceFact,
  DemonHunterCancelFact,
  DemonHunterPoisonImmuneFact,
} from "./facts/demon-hunter";
import type { WeddingPair, WeddingGroup, WeddingKnifeCapture } from "./facts/ghost-bride";
import type { DeathCause } from "./death-facts";
import type { ActionWindow, Camp, EntityId, Phase, PotionType, Role } from "./identity";
import type { InspectionResult } from "./inspection";
import type { RoleId } from "./role-ids";
import type { GameResult } from "./results";

/** type 与 payload 由下方映射关联；timestamp 是原事实时间数据，不是行动期限或顺序证明。 */
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

/** 上帝私有信息保原 string 字段宽度；其中 role／camp 是记录数据，不是现场组件或当前授权。 */
export interface PrivatePlayerInfo {
  id: EntityId;
  seat: number;
  name: string;
  role: string;
  camp: string;
}

/** 放逐反馈的当时 camp 查验标签副本；实际有效目标、捕获时点与下一夜交付归原规则／阶段，类型不证明目标已死。 */
export interface ExileFeedback {
  exileDay: number;
  targetId: EntityId;
  result: Extract<InspectionResult, { kind: "camp" }>;
}

/** 每种事实保原字段／可选性，并合入本族声明；记录名中的 committed 不单独证明完整业务或录制成功。 */
export interface EventPayloadMap
  extends NobleSecretBodyPayloadMap, FragrantPairPayloadMap, AnimalDreamPayloadMap {
  eclipse_swallowed: {
    actorId: EntityId;
    day: number;
    targetId: EntityId | null;
    roleId: RoleId | null;
    abilityId: string | null;
  };
  eclipse_native_suppressed: { playerId: EntityId; day: number };
  eclipse_native_restored: { playerId: EntityId; day: number };
  eclipse_lease_closed: {
    actorId: EntityId;
    day: number;
    targetId: EntityId | null;
    abilityId: string | null;
    status: "committed" | "aborted";
  };
  radiant_shelter_chosen: {
    actorId: EntityId;
    day: number;
    targetId: EntityId | null;
    abilityId: string;
  };
  alchemist_mist_chosen: { actorId: EntityId; day: number; targetIds: EntityId[] | null };
  alchemist_mist_skipped: {
    actorId: EntityId;
    day: number;
    reason: "dead" | "spent" | "no_targets";
  };
  alchemist_snake_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  raven_unsealed: { actorId: EntityId; day: number; awakened: true; knownTeammateIds: EntityId[] };
  raven_knife_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  raven_knife_skipped: {
    actorId: EntityId;
    day: number;
    reason: "dead" | "sealed" | "spent" | "no_targets";
  };
  mist_knife_drawn: { day: number; candidates: EntityId[]; targetId: EntityId | null };
  modifier_choice_committed: {
    actorId: EntityId;
    day: number;
    mode: "enhance" | "weaken" | null;
    targetId: EntityId | null;
  };
  modifier_choice_skipped: {
    actorId: EntityId;
    day: number;
    reason: "first_night" | "exhausted" | "dead";
  };
  modifier_conflict_resolved: {
    day: number;
    kind: "same_good" | "both_wolves";
    targetId: EntityId;
  };
  modifier_bonus_resolved: {
    actorId: EntityId;
    day: number;
    kind: "check" | "guard" | "poison" | "kill";
    targetId: EntityId | null;
    abstain: boolean;
    isWerewolf?: boolean;
  };
  time_consort_lock_committed: { actorId: EntityId; day: number; targetId: EntityId | null };
  time_consort_lock_skipped: { actorId: EntityId; day: number; reason: "exhausted" | "dead" };
  time_consort_reflected: {
    actorId: EntityId;
    day: number;
    sourceId: EntityId;
    requestedId: EntityId;
    effectiveId: EntityId;
    kind: "check" | "guard" | "poison";
  };
  wolf_sorcerer_exchange_committed: {
    actorId: EntityId;
    day: number;
    pair: [EntityId, EntityId] | null;
  };
  wolf_sorcerer_exchange_skipped: {
    actorId: EntityId;
    day: number;
    reason: "not_started" | "exhausted" | "dead";
  };
  trickster_exchange_committed: {
    actorId: EntityId;
    day: number;
    pair: [EntityId, EntityId] | null;
  };
  trickster_exchange_skipped: { actorId: EntityId; day: number; reason: "exhausted" | "dead" };
  exile_target_mapped: { requestedId: EntityId; effectiveId: EntityId; missed: boolean };
  death_shot_missed: { actorId: EntityId; reason: "no_effect" };
  magician_exchange_committed: {
    actorId: EntityId;
    day: number;
    pair: [EntityId, EntityId] | null;
  };
  red_moon_night_sealed: RedMoonNextNightFact;
  red_moon_exile_delayed: RedMoonNextNightFact;
  red_moon_delay_expired: RedMoonExpiryFact;
  crow_curse_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  crow_curse_applied: { day: number; targetId: EntityId; bonus: 1; round: 1 | 2 };
  nightmare_fear_committed: { actorId: EntityId; day: number; targetId: EntityId | null };
  demon_hunter_chosen: DemonHunterChoiceFact;
  demon_hunter_cancelled: DemonHunterCancelFact;
  demon_hunter_poison_immune: DemonHunterPoisonImmuneFact;
  ghost_bride_pair_chosen: WeddingPair;
  ghost_bride_group_chosen: WeddingGroup;
  ghost_bride_knife_captured: WeddingKnifeCapture;
  ghost_bride_witness_vote: {
    policy: "awa_melbourne_ghost_bride_v1";
    groupId: string;
    day: 1;
    actorId: EntityId;
    targetId: EntityId;
    voteIndex: 1 | 2;
  };
  ghost_bride_partner_chat: {
    policy: "awa_melbourne_ghost_bride_v1";
    groupId: string;
    day: number;
    actorId: EntityId;
    recipientId: EntityId;
    text: string;
  };
  ghost_bride_knife_vote: {
    policy: "awa_melbourne_ghost_bride_v1";
    groupId: string;
    day: number;
    owner: "ordinary_pack" | "pair" | "witness";
    actorId: EntityId;
    targetId: EntityId | null;
    abstain: boolean;
  };
  ghost_bride_knife_resolved: WeddingKnifeCapture & { targetId: EntityId | null };
  ghost_bride_partner_death: {
    policy: "awa_melbourne_ghost_bride_v1";
    groupId: string;
    day: number;
    actorId: EntityId;
    targetId: EntityId;
    phase: Phase;
  };
  lonely_girl_admired_chosen: {
    policy: "awa_netease_lonely_girl_v1";
    actorId: EntityId;
    day: 1;
    targetId: EntityId;
    camp: Camp;
  };
  wild_child_model_chosen: { actorId: EntityId; day: 1; targetId: EntityId };
  wild_child_model_eliminated: {
    actorId: EntityId;
    targetId: EntityId;
    day: number;
    phase: Phase;
    deathCommit: string;
    sources: DeathCause[];
    deadIds: EntityId[];
  };
  wild_child_transformed: {
    actorId: EntityId;
    day: number;
    eligibleNight: number;
    camp: Camp.Wolf;
    deathCommit: string;
  };
  wild_child_pack_activated: { actorId: EntityId; day: number; eligibleNight: number };
  wall_notes_started: { day: 1; eventId: "awa_wall_notes_v1" };
  wall_notes_published: { day: 1; eventId: "awa_wall_notes_v1"; texts: string[] };
  wall_notes_canceled: { day: 1; eventId: "awa_wall_notes_v1"; reason: "scope_changed" };
  thief_initial_deal: {
    policy: "lui_meme_thief_two_extra_villagers_v1";
    roles: Role[];
    boardSize: number;
  };
  thief_identity_chosen: {
    policy: "lui_meme_thief_two_extra_villagers_v1";
    actorId: EntityId;
    day: 1;
    slot: 0 | 1 | null;
    role: Role;
    camp: Camp;
  };

  shapeshifter_initial_deal: {
    policy: "awa_netease_shapeshifter_two_extra_villagers_v1";
    roles: Role[];
    boardSize: number;
  };
  shapeshifter_identity_chosen: {
    policy: "awa_netease_shapeshifter_two_extra_villagers_v1";
    actorId: EntityId;
    day: 1;
    slot: 0 | 1;
    role: Role;
    camp: Camp;
  };
  wall_note_changed: {
    actorId: number;
    day: 1;
    eventId: "awa_wall_notes_v1";
    itemId: "anonymous_note";
    instanceId: string;
    operation: "granted" | "accepted" | "rejected" | "revoked" | "expired";
    remaining: 0 | 1;
    expired: boolean;
    text?: string;
  };
  wall_note_order_recorded: {
    day: 1;
    eventId: "awa_wall_notes_v1";
    rows: Array<{ actorId: number; instanceId: string; text: string; rank: number }>;
  };
  debate_ballots_recorded: {
    actorId: EntityId;
    targetId: EntityId;
    day: number;
    eligibleCount: number;
    ballots: Array<{ voterId: EntityId; support: boolean | null }>;
  };
  debater_revealed: { actorId: EntityId; day: number };
  debate_started: { actorId: EntityId; targetId: EntityId; day: number };
  debate_speech: { actorId: EntityId; text: string };
  debate_resolved: {
    actorId: EntityId;
    targetId: EntityId;
    day: number;
    eligibleCount: number;
    supports: number;
    rejects: number;
    abstentions: number;
    success: boolean;
    blockedId: EntityId;
  };
  debate_canceled: { actorId: EntityId; targetId: EntityId; day: number; reason: "scope_changed" };
  cupid_lovers_chosen: { actorId: EntityId; day: 1; pairIds: [EntityId, EntityId] };
  lover_recognized: { actorId: EntityId; partnerId: EntityId };
  cupid_relation_resolved: import("./cupid-relation").LoversComponent;
  lovers_death: { actorId: EntityId; targetId: EntityId };
  order_prince_choice_committed: { actorId: EntityId; day: number; activate: boolean };
  order_prince_revote_started: { actorId: EntityId };
  player_role_revealed: { playerId: EntityId; role: RoleId };
  sheriff_pk_started: { candidates: EntityId[] };
  exile_pk_started: { candidates: EntityId[] };
  black_market_trade_skipped: { actorId: EntityId; day: number };
  black_market_trade_committed: {
    actorId: EntityId;
    day: number;
    targetId: EntityId;
    skill: "check" | "poison" | "gun";
  };
  black_market_trade_resolved: {
    actorId: EntityId;
    day: number;
    targetId: EntityId;
    skill: "check" | "poison" | "gun";
    outcome: "granted" | "backlash";
  };
  death_ability_changed: {
    actorId: EntityId;
    abilityId: string;
    operation: "granted" | "armed" | "disabled" | "enabled" | "transferred_out";
    grantedNight: number;
    armedOnNight: number | null;
    remaining: 0 | 1;
    disabled: boolean;
    deathExpired: boolean;
  };
  ability_changed: {
    actorId: EntityId;
    abilityId: string;
    kind: "pair_check" | "seer_check" | "role_check" | "guard" | "potion" | "dream" | "shelter";
    operation: "granted" | "disabled" | "enabled" | "transferred_out";
    source:
      | { kind: "native"; role: string }
      | { kind: "gift"; actorId: EntityId }
      | { kind: "copy" | "transfer"; actorId: EntityId; abilityId: string };
    sourceDisclosed: boolean;
    startsOnDay: number;
    expiresAfterDay?: number;
    maxUses: number | null;
  };
  god_private_game_info: { boardSize: number; players: PrivatePlayerInfo[] };
  phase_changed: {
    phase: Phase;
    day: number;
    winner?: Camp | null;
    reason?: string;
    outcome?: GameResult["outcome"];
    decidedAt?: GameResult["decidedAt"];
  };
  sheriff_elected: {
    winnerId: EntityId;
    source?: string;
    candidates?: EntityId[];
    tally?: Record<number, number>;
  };
  game_over: GameResult;
  night_resolved: { deaths: EntityId[] };
  bear_roared: { day: number; roared: boolean };
  hidden_wolf_awakened: { actorId: EntityId; day: number };
  gargoyle_awakened: { actorId: EntityId; day: number };
  mechanical_awakened: { actorId: EntityId; day: number; firstKnifeNight: number };
  awakened_inherited: { actorId: EntityId; day: number; firstKnifeNight: number };
  awakened_mimicked: { actorId: EntityId; day: number; targetId: EntityId; role: RoleId };
  awakened_mimic_skipped: { actorId: EntityId; day: number };
  awakened_ready: {
    actorId: EntityId;
    activationNight: number;
    activeFromNight: number;
    role: RoleId;
  };
  awakened_skill_skipped: { actorId: EntityId; day: number };
  awakened_poison_used: { actorId: EntityId; day: number; targetId: EntityId };
  awakened_guard_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  awakened_attack_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  mechanical_mode_selected: { actorId: EntityId; day: number; mode: "kill" | "skill" };
  mechanical_mimicked: {
    actorId: EntityId;
    day: number;
    targetId: EntityId;
    role: RoleId;
    readyOnNight: number;
  };
  mechanical_mimic_skipped: { actorId: EntityId; day: number };
  mechanical_skill_skipped: { actorId: EntityId; day: number };
  mechanical_poison_used: { actorId: EntityId; day: number; targetId: EntityId };
  mechanical_guard_chosen: {
    actorId: EntityId;
    day: number;
    targetId: EntityId | null;
    failed: boolean;
  };
  mechanical_attack_chosen: { actorId: EntityId; day: number; targetId: EntityId | null };
  mechanical_poison_reflected: {
    actorId: EntityId;
    day: number;
    protectedTargetId: EntityId;
    casterId: EntityId;
  };
  mechanical_shot: { actorId: EntityId; targetId: EntityId };
  role_inspection_skipped: {
    actorId: EntityId;
    abilityId?: string;
    day: number;
    reason: "passed" | "no_targets";
  };
  lucky_ability_skipped: {
    actorId: EntityId;
    abilityId: string;
    day: number;
    kind: "seer_check" | "potion" | "guard";
  };
  hybrid_exemplar_chosen: { actorId: EntityId; day: number; targetId: EntityId };
  hybrid_affiliation_resolved: {
    actorId: EntityId;
    day: number;
    targetId: EntityId;
    faction: "good" | "wolf";
  };
  merchant_trade_committed: {
    actorId: EntityId;
    day: number;
    targetId: EntityId;
    skill: "check" | "poison" | "guard";
  };
  merchant_trade_skipped: { actorId: EntityId; day: number };
  merchant_trade_resolved: {
    actorId: EntityId;
    day: number;
    targetId: EntityId;
    skill: "check" | "poison" | "guard";
    outcome: "granted" | "backlash";
  };
  role_inspected: {
    actorId: EntityId;
    abilityId?: string;
    targetId: EntityId;
    day: number;
    result: Extract<InspectionResult, { kind: "role" }>;
  };
  wolf_self_destruct: { wolfId: EntityId; window: ActionWindow };
  white_wolf_king_self_destruct: {
    actorId: EntityId;
    targetId: EntityId | null;
    window: ActionWindow;
  };
  knight_duel: { actorId: EntityId; targetId: EntityId; result: "wolf" | "not_wolf" };
  gravekeeper_reported: ExileFeedback & { actorId: EntityId; receivedDay: number };
  dream_applied: {
    actorId: EntityId;
    abilityId?: string;
    targetId: EntityId;
    day: number;
    consecutive: boolean;
  };
  charm_applied: { actorId: EntityId; targetId: EntityId | null; day: number };
  charm_death: { actorId: EntityId; targetId: EntityId };
  charm_blocked: { actorId: EntityId; targetId: EntityId; reason: "night_protection" };
  dream_death: {
    actorId: EntityId;
    abilityId?: string;
    targetId: EntityId;
    day: number;
    reason: "consecutive" | "linked";
  };
  death_shot_blocked: { actorId: EntityId; targetId: EntityId; reason: "night_protection" };
  additional_deaths: { deaths: EntityId[] };
  day_speech: { actorId: EntityId; text: string };
  vote_cast: VoteRecord;
  vote_summary: {
    round?: number;
    votes: VoteRecord[];
    tally: Record<number, number>;
    target: EntityId | null;
  };
  voted_out: { target: EntityId };
  last_words_granted: { playerId: EntityId; phase: Phase; day: number };
  last_words_spoken: { playerId: EntityId; phase: Phase; day: number; text: string };
  guard_applied: {
    actorId: EntityId;
    abilityId?: string;
    abstain: boolean;
    targetId: EntityId | null;
  };
  seer_checked: {
    actorId: EntityId;
    abilityId?: string;
    targetId: EntityId;
    result: Extract<InspectionResult, { kind: "camp" }>;
    isWerewolf: boolean;
  };
  hunter_silent_due_to_poison: { hunterId: EntityId };
  hunter_shot: { hunterId: EntityId; targetId: EntityId };
  /** 公共开枪事实不披露技能原生或复制来源；不据该记录推断剩余枪权。 */
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
  witch_potion_used: {
    actorId: EntityId;
    abilityId?: string;
    targetId: EntityId;
    potionType: Exclude<PotionType, PotionType.None>;
  };
  wolf_tactical_order: { order: EntityId[] };
  wolf_discussion_ended: { actorId: EntityId; reason: string; round: number };
  wolf_discussion: { actorId: EntityId; text: string; endChat: false; round: number };
  wolf_kill_vote_cast: {
    actorId: EntityId;
    abstain: boolean;
    targetId: EntityId | null;
    fallback?: boolean;
  };
  sheriff_badge_destroyed: { targetId: EntityId; reason: string };
  sheriff_badge_transferred: { fromId: EntityId; toId: EntityId; reason: string };
  sheriff_vote_summary: {
    round?: number;
    votes: SheriffVoteRecord[];
    winnerId: EntityId | null;
  };
  sheriff_candidate_declared: { actorId: EntityId; run: boolean };
  sheriff_nomination_summary: { candidates: EntityId[] };
  sheriff_withdraw_summary: { withdrawn: EntityId[] };
  sheriff_candidates_finalized: { candidates: EntityId[] };
  sheriff_vote_cast: SheriffVoteRecord;
  sheriff_direction_chosen: { sheriffId: EntityId; direction: "clockwise" | "counter_clockwise" };
}

export const WOLF_TEAM_EVENT_TYPES = [
  "mist_knife_drawn",
  "wolf_tactical_order",
  "wolf_discussion",
  "wolf_discussion_ended",
  "wolf_kill_vote_cast",
] as const;
export type WolfTeamEventType = (typeof WOLF_TEAM_EVENT_TYPES)[number];

export type WeddingEventType =
  | "ghost_bride_pair_chosen"
  | "ghost_bride_group_chosen"
  | "ghost_bride_knife_captured"
  | "ghost_bride_witness_vote"
  | "ghost_bride_partner_chat"
  | "ghost_bride_knife_vote"
  | "ghost_bride_knife_resolved"
  | "ghost_bride_partner_death";

/** 指定私有事实必带发表时 audience；readonly 只约束类型写法，不冻结数组，历史受众不是现场权限表。 */
export type GameEvent = {
  [K in keyof EventPayloadMap]: EventBase<K, EventPayloadMap[K]> &
    (K extends
      | Exclude<keyof AnimalDreamPayloadMap, "animal_cat_revealed" | "animal_puffer_revealed">
      | "eclipse_swallowed"
      | "eclipse_native_suppressed"
      | "eclipse_native_restored"
      | "eclipse_lease_closed"
      | "radiant_shelter_chosen"
      | "noble_body_night_opened"
      | "noble_body_knife_committed"
      | "fragrant_pair_chosen"
      | "fragrant_wave_committed"
      | "fragrant_night_opened"
      | "fragrant_pair_inspected"
      | "fragrant_night_notified"
      | "fragrant_binding_expired"
      | "fragrant_link_triggered"
      | "noble_body_native_damage_committed"
      | "noble_body_sources_committed"
      | "noble_body_death_committed"
      | "noble_servant_chosen"
      | "secret_body_chosen"
      | "noble_contract_closed"
      | "secret_body_blocked"
      | "noble_night_notified"
      | "secret_body_night_notified"
      | WolfTeamEventType
      | WeddingEventType
      | "alchemist_mist_chosen"
      | "alchemist_mist_skipped"
      | "alchemist_snake_chosen"
      | "raven_unsealed"
      | "raven_knife_chosen"
      | "raven_knife_skipped"
      | "crow_curse_chosen"
      | "nightmare_fear_committed"
      | "modifier_choice_committed"
      | "modifier_choice_skipped"
      | "modifier_conflict_resolved"
      | "modifier_bonus_resolved"
      | "time_consort_lock_committed"
      | "time_consort_lock_skipped"
      | "time_consort_reflected"
      | "wolf_sorcerer_exchange_committed"
      | "wolf_sorcerer_exchange_skipped"
      | "trickster_exchange_committed"
      | "trickster_exchange_skipped"
      | "magician_exchange_committed"
      | "order_prince_choice_committed"
      | "demon_hunter_chosen"
      | "demon_hunter_cancelled"
      | "demon_hunter_poison_immune"
      ? { readonly audience: readonly EntityId[] }
      : {});
}[keyof EventPayloadMap];

/** 玩家投影协议保 type／payload 的开放形状；seq 由实际 feed／读器处理，声明不保证连续，也不授行动许可。 */
export interface PlayerVisibleEvent {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
}
