/**
 * 定义内建角色的纯数据展示片段结构。输入是展示捕获在原读取点选出的标量、
 * 已序列化的玩家知识或具体文案片段（参数可含前一片段已格式化的文字）；输出不含 World、角色组件、能力、回调或写权限。
 * 片段按原顺序同步格式化，不能先收齐所有状态而改变失败前缀。运行时仍保留
 * 原 JSON.stringify(undefined) 的格式校验失败；类型不授予传出未知值的权限，也不把缺失知识改为 null。
 */
import type { Role } from "./identity";

/** 支持集合直接取现有运行角色枚举，不另维护角色清单；计划角色不隐式获得 renderer。 */
/** 原生捕获仅用于既有角色；新增乌鸦通过本族值查询贡献展示，不扩大中央分派。 */
export type NativeRolePresentationId = Exclude<
  `${Role}`,
  "crow" | "silence_elder" | "warden" | "awakened_wolf_king" | "awakened_witch"
>;

/** 字段限定为实际文案参数；具体 key 与字段集合仍由原文字格式校验器检查。 */
export interface NativeRoleMessageParameters {
  "role.white_cat.brief": undefined;
  "role.fox_cub.brief": undefined;
  "role.pufferfish.brief": undefined;
  "role.fragrant_phantom.brief": undefined;
  "role.awakened_seer.brief": undefined;
  "role.night_noble.brief": undefined;
  "role.awakened_idiot.brief": undefined;
  "role.radiant_count.brief": undefined;
  "role.eclipse_maid.brief": undefined;
  "role.alchemist.brief": undefined;
  "role.raven_claw_wolf.brief": undefined;
  "role.night_mentor.brief": undefined;
  "role.day_scholar.brief": undefined;
  "role.time_wolf_consort.brief": undefined;
  "role.time_wolf_consort.scope_first_effect": undefined;
  "role.time_wolf_consort.scope_whole_night": undefined;
  "role.wolf_sorcerer.brief": undefined;
  "role.wolf_sorcerer.first_night": { readonly day: string | number };
  "role.trickster.brief": undefined;
  "role.order_prince.brief": undefined;
  "role.magician.brief": undefined;
  "role.magician.trickster_rule": undefined;
  "role.magician.sorcerer_rule": undefined;
  "role.magician.heal_rule": undefined;
  "role.magician.first_night": { readonly day: string | number };
  "role.magician.shots_exchanged": undefined;
  "role.magician.shots_original": undefined;
  "role.red_moon_apostle.state": {
    readonly blastDay: string | number;
    readonly exileDay: string | number;
  };
  "replay.none": undefined;
  "role.red_moon_apostle.last_wolf_forbidden": undefined;
  "role.red_moon_apostle.last_wolf_ends": undefined;
  "role.nightmare.state": undefined;
  "role.nightmare.required": undefined;
  "role.nightmare.optional": undefined;
  "role.nightmare.standard": undefined;
  "role.nightmare.no_blast": undefined;
  "role.evil_knight.state": { readonly remaining: string | number };
  "role.evil_knight.gun_bypasses": undefined;
  "role.evil_knight.gun_immune": undefined;
  "role.demon_hunter.state": { readonly state: string | number };
  "role.ghost_bride.state": { readonly state: string | number };
  "role.wild_child.state": {
    readonly camp: string | number;
    readonly state: string | number;
  };
  "role.lonely_girl.state": { readonly state: string | number };
  "role.thief.state": { readonly state: string | number };
  "role.shapeshifter.state": { readonly state: string | number };
  "role.wolf.state": undefined;
  "role.wolf_king.configured_state": { readonly remaining: string | number };
  "role.wolf_king.state": { readonly remaining: string | number };
  "role.white_wolf_king.state": { readonly remaining: string | number };
  "role.knight.state": { readonly remaining: string | number };
  "role.gravekeeper.state": undefined;
  "role.gravekeeper.latest": {
    readonly exileDay: string | number;
    readonly receivedDay: string | number;
    readonly target: string | number;
    readonly result: string | number;
  };
  "role.gravekeeper.no_report": undefined;
  "replay.unknown": undefined;
  "role.dreamer.state": undefined;
  "role.dreamer.protection_netease": undefined;
  "role.dreamer.protection_awa": undefined;
  "role.dreamer.latest": {
    readonly target: string | number;
    readonly day: string | number;
  };
  "role.wolf_beauty.state": undefined;
  "role.wolf_beauty.link_s7": undefined;
  "role.wolf_beauty.link_awa": undefined;
  "role.wolf_beauty.latest": {
    readonly target: string | number;
    readonly day: string | number;
  };
  "common.none": undefined;
  "role.bear.dawn_brief": undefined;
  "role.bear.state": undefined;
  "role.bear.latest": {
    readonly day: string | number;
    readonly result: string | number;
  };
  "bear.roar": undefined;
  "bear.quiet": undefined;
  "role.bear.no_report": undefined;
  "role.cursed_fox.state": undefined;
  "role.cupid.state": undefined;
  "role.cupid.lui": undefined;
  "role.cupid.netease": undefined;
  "role.cupid.status": { readonly state: string | number };
  "role.debater.state": undefined;
  "role.debater.status": { readonly state: string | number };
  "role.hidden_wolf.state_good_v1": undefined;
  "role.hidden_wolf.state": undefined;
  "role.hidden_wolf.status": {
    readonly inherited: string | number;
    readonly active: string | number;
  };
  "common.yes": undefined;
  "common.no": undefined;
  "role.gargoyle.configured_identity": undefined;
  "role.gargoyle.state": undefined;
  "role.gargoyle.status": {
    readonly inherited: string | number;
    readonly active: string | number;
  };
  "inspection.latest": {
    readonly target: string | number;
    readonly result: string | number;
  };
  "role.psychic.configured_identity": undefined;
  "role.psychic.state": undefined;
  "role.mechanical_wolf.state": undefined;
  "role.mechanical_wolf.status": {
    readonly learned: string | number;
    readonly ready: string | number;
    readonly inherited: string | number;
    readonly first: string | number;
    readonly mode: string | number;
    readonly resources: string | number;
  };
  "mechanical.mode.kill": undefined;
  "mechanical.mode.skill": undefined;
  "role.miracle_merchant.state": undefined;
  "role.miracle_merchant.status": { readonly state: string | number };
  "role.black_market_merchant.state": undefined;
  "role.black_market_merchant.status": { readonly state: string | number };
  "role.hybrid.state": undefined;
  "role.hybrid.status": { readonly state: string | number };
  "role.mirror_girl.configured_identity": undefined;
  "role.mirror_girl.state": undefined;
  "role.awakened_hidden_wolf.state": undefined;
  "role.awakened_hidden_wolf.status": {
    readonly learned: string | number;
    readonly activation: string | number;
    readonly ready: string | number;
    readonly inherited: string | number;
    readonly first: string | number;
    readonly resources: string | number;
  };
  "role.villager.state": undefined;
  "role.seer.latest": {
    readonly target: string | number;
    readonly camp: string | number;
  };
  "role.seer.state": undefined;
  "role.seer.targets_fresh": undefined;
  "role.seer.targets_alive": undefined;
  "role.seer.action_required": undefined;
  "role.seer.action_optional": undefined;
  "role.guard.state": undefined;
  "role.guard.repeat_actual_nights": undefined;
  "role.guard.repeat_last_action": undefined;
  "role.witch.state": {
    readonly heal: string | number;
    readonly poison: string | number;
  };
  "role.witch.knife_always": undefined;
  "role.witch.knife_with_heal": undefined;
  "role.witch.potions_both": undefined;
  "role.witch.potions_one": undefined;
  "role.hunter.configured_state": undefined;
  "role.hunter.state": undefined;
  "role.idiot.state": undefined;
  "role.wolf_witch.state": undefined;
  "role.pure_white_girl.state": undefined;
  "inspection.combined": {
    readonly role: string | number;
    readonly camp: string | number;
  };
  "role.inspection.repeat_optional": undefined;
  "role.inspection.unique_required": undefined;
  "role.inspection.unique_optional": undefined;
  "role.death_action.day_deaths": undefined;
  "role.death_action.knife_exile": undefined;
  "role.death_action.qualified": undefined;
}
export type NativeRoleMessageKey = keyof NativeRoleMessageParameters;
/** 每种角色文案的参数集合有独立关联，不能传 live state 代替已选字段。 */
export type NativeRoleMessagePart = {
  [K in NativeRoleMessageKey]: {
    readonly kind: "message";
    readonly key: K;
    readonly parameters: NativeRoleMessageParameters[K];
  };
}[NativeRoleMessageKey];
export type NativeRolePresentationPart =
  | NativeRoleMessagePart
  | { readonly kind: "role-label"; readonly role: string }
  | { readonly kind: "camp-label"; readonly camp: string }
  | { readonly kind: "death-policy"; readonly policy: string | undefined };
