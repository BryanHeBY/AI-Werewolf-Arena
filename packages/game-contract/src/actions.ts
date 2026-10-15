/**
 * 负责工具调用、验证结果和回合约束的公共数据声明；输入为机器身份与中立消息引用，
 * 输出为原工具参数联合、顺序化工具／阶段标识及可选约束字段。
 * 名称与参数不授行动权；角色资格、目标政策和当前库存由领域 owner 复验。
 * 本契约不持 Actor、World、资源或传输生命周期，不校验未知输入或执行回合。
 */
import { ActionWindow, KnightDuelWindow, type EntityId, type PotionType } from "./identity";
import type { MessageRef } from "./message-refs";
/** 工具名关联其原参数形状；null／abstain／activate 各有原业务意义，不在类型层统一成同一种跳过。 */
export interface ToolArgMap {
  awakened_protect: { mode: "protect" | "wait" | "pass"; target_id: EntityId | null };
  awakened_duel: { target_id: EntityId | null };
  awakened_brew: {
    mode: "heal" | "poison" | "pass";
    target_id: EntityId | null;
    assistant_ids: EntityId[];
  };
  brew_discuss: { text: string };
  brew_approve: { approve: boolean };
  warden_pair: { target_ids: readonly [EntityId, EntityId] | null };
  warden_decide: { choice: "trade" | "betray" };
  bequeath_claw: { target_id: EntityId | null };
  silence: { target_id: EntityId; translator_id: EntityId | null };
  gesture: { description: string };
  translate_silence: { text: string | null };
  curse_exile: { target_id: EntityId | null };
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
  awakened_charm: { target_id: EntityId | null };
  patrol: { direction: "clockwise" | "counter_clockwise" | null };
}

export type ToolName = keyof ToolArgMap;
/** 保留公共工具标识的原顺序；列入此表不表示任意角色或阶段都可使用。 */
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
  "awakened_brew",
  "brew_discuss",
  "brew_approve",
  "warden_pair",
  "warden_decide",
  "bequeath_claw",
  "curse_exile",
  "silence",
  "gesture",
  "translate_silence",
  "awakened_charm",
  "patrol",
  "awakened_protect",
  "awakened_duel",
] as const satisfies readonly ToolName[];
/** name 是判别字段，args 随工具一一关联；结构匹配不等于已通过 Gateway 或已付款。 */
export type ToolCall = { [K in ToolName]: { name: K; args: ToolArgMap[K] } }[ToolName];
export type TypedToolCall<T extends ToolName> = Extract<ToolCall, { name: T }>;

/** 原验证回包不是提交回执；ok 未在类型中强制关联 sanitizedCall，调用方仍按实际校验流程处理。 */
export interface ToolValidationResult<T extends ToolCall = ToolCall> {
  ok: boolean;
  sanitizedCall?: T;
  /** 稳定机器错误码，不随语言变化；可读 message 另由实际校验／文案调用方提供。 */
  error?: string;
  message?: string;
}

/** 可选回合约束保持缺省形状；默认最少／最多动作及异常策略由原运行解析 owner 决定。 */
export interface TurnConstraints {
  min_valid_actions?: number;
  max_valid_actions?: number;
  required_any_tools?: ToolName[];
  /** 旧调用方／自定义摘要保原文；summary_message 是独立消息引用，不在这里替换或渲染原文。 */
  summary?: string;
  summary_message?: MessageRef;
}

/** 保留阶段字面值及两个窗口枚举的原展开顺序；此清单不推进阶段或打开行动窗口。 */
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
  "awakened_witch",
  "brew_discussion",
  "brew_approval",
  "warden_pair",
  "warden_decide",
  "crow_curse",
  "awakened_claw_bequest",
  "silence_elder",
  "silence_gesture",
  "silence_translation",
  "awakened_charm",
  "awakened_patrol",
  "awakened_protection_night",
  "awakened_protection_day",
  "awakened_duel",
  "awakened_duel_continue",
] as const;
export type ActionStage = (typeof ACTION_STAGES)[number];
export const DEATH_SHOT_STAGES: readonly ActionStage[] = ["hunter_shot", "death_shot"];
