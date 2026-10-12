/**
 * Owns the night modifiers translations and their neutral key/placeholder definitions.
 * Inputs are existing contract MessageKeys and literal bilingual templates;
 * outputs are matching Chinese/English fragments and named parameter arrays.
 * Empty arrays explicitly mean no interpolation parameters. These definitions
 * never parse facts, execute rules, or validate user-supplied parameters; the
 * shared formatter retains that runtime boundary and preserves raw user text.
 */
import type { MessageDefinition } from "../definition";

export const definition = {
  owner: "features/night-modifiers",
  parameters: {
    "role.demon_hunter.brief": [],
    "role.demon_hunter.state": ["state"],
    "action.demon_hunt.hint": [],
    "stage.demon_hunter": [],
    "console.demon_hunter.chosen": ["actor", "day", "target"],
    "console.demon_hunter.own": ["day", "target"],
    "console.demon_hunter.cancelled": ["actor", "day", "fault", "target"],
    "console.demon_hunter.poison_immune": ["actor", "day", "witch"],
    "replay.stage.demon_hunter_chosen": [],
    "replay.stage.demon_hunter_cancelled": [],
    "replay.stage.demon_hunter_poison_immune": [],
    "death.evil_knight_reflection": [],
    "death.pure_white_inspection": [],
    "death.wolf_witch_inspection": [],
    "death.demon_hunt": [],
    "death.demon_hunt_backlash": [],
    "death.red_moon_expiry": [],
    "console.red_moon.seal": ["actor", "night"],
    "console.red_moon.exile": ["actor", "night"],
    "console.red_moon.expiry": ["actor", "day"],
    "console.role_inspection.skipped": ["actor", "day", "reason"],
    "replay.stage.role_inspection_skipped": [],
    "console.nightmare.own": ["day", "target"],
    "console.nightmare.pass": [],
    "role.red_moon_apostle.brief": [],
    "role.red_moon_apostle.state": ["blastDay", "exileDay"],
    "role.red_moon_apostle.last_wolf_forbidden": [],
    "role.red_moon_apostle.last_wolf_ends": [],
    "console.magician.pass": [],
    "console.magician.own": ["day", "pair"],
    "role.magician.heal_rule": [],
    "event.order_prince_choice_committed": ["choice", "day"],
    "console.order_prince.activate": [],
    "console.order_prince.decline": [],
    "stage.order_prince_choice": [],
    "stage.order_prince_speech": [],
    "stage.order_prince_revote": [],
    "event.time_consort_lock_committed": ["actor", "day", "target"],
    "event.time_consort_skipped_dead": ["actor", "day"],
    "event.time_consort_skipped_exhausted": ["actor", "day"],
    "event.time_consort_reflected": ["actor", "day", "effective", "skill", "source", "target"],
    "time_consort.skill.check": [],
    "time_consort.skill.guard": [],
    "time_consort.skill.poison": [],
    "role.time_wolf_consort.brief": [],
    "role.time_wolf_consort.scope_whole_night": [],
    "role.time_wolf_consort.scope_first_effect": [],
    "action.lock_time.hint": [],
    "action.lock_time.directive": [],
    "error.time_consort_unavailable": [],
    "error.time_consort_target": [],
    "stage.time_consort_lock": [],
    "replay.stage.time_consort_lock": [],
    "replay.stage.time_consort_lock_committed": [],
    "replay.stage.time_consort_lock_skipped": [],
    "replay.stage.time_consort_reflected": [],
    "prompt.config.scholar_mentor": [],
    "role.day_scholar.brief": [],
    "role.night_mentor.brief": [],
    "action.modify_skill.hint": [],
    "action.modify_skill.directive": [],
    "action.bonus_action.hint": [],
    "action.bonus_action.directive": [],
    "error.modifier_unavailable": [],
    "error.modifier_target": [],
    "prompt.stage.modifier_choice": ["modes"],
    "prompt.stage.modifier_bonus": ["kind"],
    "stage.scholar_mentor_choice": [],
    "stage.scholar_mentor_bonus": [],
    "replay.stage.scholar_mentor_choice": [],
    "replay.stage.scholar_mentor_bonus": [],
    "replay.stage.modifier_choice_committed": [],
    "replay.stage.modifier_choice_skipped": [],
    "replay.stage.modifier_conflict_resolved": [],
    "replay.stage.modifier_bonus_resolved": [],
    "prompt.stage.modifier_poison_blocked": [],
    "modifier.pass": [],
    "modifier.enhance": [],
    "modifier.weaken": [],
    "modifier.first_night": [],
    "modifier.dead": [],
    "modifier.exhausted": [],
    "modifier.same_good": [],
    "modifier.both_wolves": [],
    "modifier.check": [],
    "modifier.guard": [],
    "modifier.poison": [],
    "modifier.kill": [],
    "modifier.result_wolf": [],
    "modifier.result_good": [],
    "event.modifier_choice": ["actor", "day", "mode", "target"],
    "event.modifier_skip": ["actor", "day", "reason"],
    "event.modifier_conflict": ["day", "kind", "target"],
    "event.modifier_bonus": ["actor", "day", "skill", "target"],
    "role.wolf_sorcerer.brief": [],
    "role.wolf_sorcerer.first_night": ["day"],
    "action.swap_night_seats.hint": [],
    "action.swap_night_seats.directive": [],
    "error.wolf_sorcerer_unavailable": [],
    "error.wolf_sorcerer_target": [],
    "stage.wolf_sorcerer_exchange": [],
    "replay.stage.wolf_sorcerer_exchange": [],
    "replay.stage.wolf_sorcerer_exchange_committed": [],
    "replay.stage.wolf_sorcerer_exchange_skipped": [],
    "event.wolf_sorcerer_exchange_committed": ["actor", "day", "pair"],
    "event.wolf_sorcerer_skipped_dead": ["actor", "day"],
    "event.wolf_sorcerer_skipped_not_started": ["actor", "day"],
    "event.wolf_sorcerer_skipped_exhausted": ["actor", "day"],
    "role.magician.sorcerer_rule": [],
    "role.trickster.brief": [],
    "action.swap_exile_targets.hint": [],
    "action.swap_exile_targets.directive": [],
    "error.trickster_unavailable": [],
    "error.trickster_target": [],
    "stage.trickster_exchange": [],
    "replay.stage.trickster_exchange": [],
    "replay.stage.trickster_exchange_committed": [],
    "replay.stage.trickster_exchange_skipped": [],
    "replay.stage.exile_target_mapped": [],
    "role.magician.trickster_rule": [],
    "event.trickster_exchange_committed": ["actor", "day", "pair"],
    "event.trickster_skipped_dead": ["actor", "day"],
    "event.trickster_skipped_exhausted": ["actor", "day"],
    "event.exile_target_mapped": ["effective", "requested"],
    "event.exile_mapping_missed": ["effective", "requested"],
    "role.order_prince.brief": [],
    "action.reset_exile_vote.hint": [],
    "action.reset_exile_vote.directive": [],
    "error.order_prince_unavailable": [],
    "request.summary.order_prince_choice": [],
    "request.summary.order_prince_speech": [],
    "replay.stage.order_prince_choice_committed": [],
    "replay.stage.order_prince_revote_started": [],
    "replay.stage.order_prince_choice": [],
    "replay.stage.order_prince_speech": [],
    "replay.stage.order_prince_revote": [],
    "event.order_prince_revote_started": ["actor"],
    "role.magician.brief": [],
    "role.magician.first_night": ["day"],
    "role.magician.shots_exchanged": [],
    "role.magician.shots_original": [],
    "action.swap_targets.hint": [],
    "action.swap_targets.directive": [],
    "stage.magician_exchange": [],
    "replay.stage.magician_exchange": [],
    "replay.stage.magician_exchange_committed": [],
    "error.magician_unavailable": [],
    "error.magician_target": [],
    "console.magician.exchange": ["actor", "day", "pair"],
    "role.nightmare.brief": [],
    "role.nightmare.state": [],
    "role.nightmare.required": [],
    "role.nightmare.optional": [],
    "role.nightmare.standard": [],
    "role.nightmare.no_blast": [],
    "action.fear.hint": [],
    "action.fear.directive": [],
    "stage.nightmare_fear": [],
    "replay.stage.nightmare_fear": [],
    "replay.stage.red_moon_night_sealed": [],
    "replay.stage.red_moon_exile_delayed": [],
    "replay.stage.red_moon_delay_expired": [],
    "replay.stage.nightmare_fear_committed": [],
    "error.nightmare_unavailable": [],
    "error.nightmare_target": [],
    "console.nightmare.fear": ["actor", "day", "target"],
    "role.evil_knight.brief": [],
    "role.evil_knight.state": ["remaining"],
    "role.evil_knight.gun_immune": [],
    "role.evil_knight.gun_bypasses": [],
    "role.pure_white_girl.brief": [],
    "role.wolf_witch.brief": [],
    "role.pure_white_girl.state": [],
    "role.wolf_witch.state": [],
    "prompt.board.pure_white.wolf_priority": [],
    "prompt.board.pure_white.good_priority": [],
    "action.inspect_night_identity.hint": [],
    "stage.pure_white_girl": [],
    "stage.wolf_witch": [],
    "action.inspect_role.hint": [],
    "stage.role_inspection": [],
    "error.role_inspection_unavailable": [],
    "error.role_inspection_target": [],
    "error.role_inspection_repeat": [],
    "prompt.config.magician.first_night": ["day"],
    "prompt.config.magician.shots_exchanged": [],
    "prompt.config.magician.shots_original": [],
    "prompt.config.wolf_sorcerer.first_night": ["day"],
    "prompt.config.time_wolf_consort.scope_first_effect": [],
    "prompt.config.time_wolf_consort.scope_whole_night": [],
    "prompt.config.red_moon_apostle.last_wolf_forbidden": [],
    "prompt.config.red_moon_apostle.last_wolf_ends": [],
    "prompt.config.nightmare.required": [],
    "prompt.config.nightmare.optional": [],
    "prompt.config.nightmare.standard": [],
    "prompt.config.nightmare.no_blast": [],
    "prompt.config.evil_knight.gun_bypasses": [],
    "prompt.config.evil_knight.gun_immune": [],
  },
} as const satisfies MessageDefinition;

export const zhCN = {
  "role.demon_hunter.brief":
    "网易角色规则的具名有限AWA板适配：从第二夜起每夜可选择另一名存活玩家或明确弃猎。目标为真实狼人则次日目标死亡；目标为好人则自己反噬死亡。免疫原生女巫毒药，守卫和救药不阻挡猎杀或反噬。不会向你反馈目标阵营或毒免结果。",
  "role.demon_hunter.state":
    "你的原生猎魔历史：{state}。每个符合条件的新夜晚可作一次新选择，没有总次数库存限制，可在以后夜晚再次选择过去目标。",
  "action.demon_hunt.hint":
    "从第二夜起必须规范回复：另一名存活玩家整数target_id与abstain=false，或target_id=null与abstain=true。不能选自己或死亡者；失败不补默认动作。",
  "stage.demon_hunter": "猎魔人选择",
  "console.demon_hunter.chosen": "God：猎魔人{actor}号第{day}夜选择{target}。",
  "console.demon_hunter.own": "第{day}夜你的猎魔选择：{target}。",
  "console.demon_hunter.cancelled":
    "God：猎魔人{actor}号第{day}夜对{target}号的已提交猎魔来源撤权；故障编号{fault}。",
  "console.demon_hunter.poison_immune":
    "God：第{day}夜猎魔人{actor}号免疫原女巫{witch}号的本次毒药贡献。",
  "replay.stage.demon_hunter_chosen": "猎魔选择",
  "replay.stage.demon_hunter_cancelled": "猎魔撤权",
  "replay.stage.demon_hunter_poison_immune": "原生毒免",
  "death.evil_knight_reflection": "恶夜骑士反伤",
  "death.pure_white_inspection": "纯白验杀",
  "death.wolf_witch_inspection": "狼巫验杀",
  "death.demon_hunt": "猎魔致死",
  "death.demon_hunt_backlash": "猎魔反噬",
  "death.red_moon_expiry": "赤月延期到期",
  "console.red_moon.seal": "{actor}号赤月使徒自爆，第{night}夜好人技能被封印。",
  "console.red_moon.exile": "{actor}号赤月使徒被放逐，延迟至第{night}夜结算后死亡。",
  "console.red_moon.expiry": "第{day}夜，{actor}号赤月使徒的延期到期，现已死亡。",
  "console.role_inspection.skipped": "{actor}号在第{day}夜结束查验机会：{reason}",
  "replay.stage.role_inspection_skipped": "查验跳过",
  "console.nightmare.own": "你第{day}夜的恐惧选择：{target}",
  "console.nightmare.pass": "弃用",
  "role.red_moon_apostle.brief":
    "你是赤月使徒，属于狼人阵营。自爆后下一夜封锁好人技能；作为最后一名狼人被放逐时，延迟至下一天亮出局。",
  "role.red_moon_apostle.state": "自爆日期：{blastDay}；延迟放逐日期：{exileDay}。",
  "role.red_moon_apostle.last_wolf_forbidden": "你作为最后一名狼人时不能自爆；普通狼人权限不变。",
  "role.red_moon_apostle.last_wolf_ends":
    "你作为最后一名狼人时可以自爆；完整死亡链结束后按无狼胜利规则判胜，普通狼人权限不变。",
  "console.magician.pass": "弃用",
  "console.magician.own": "你第{day}夜的交换选择：{pair}",
  "role.magician.heal_rule":
    "女巫是否能主动自救按原始刀口号码判定：原刀口为自己时不能开解药；原刀口为别人时，解药交换到自己仍生效。",
  "event.order_prince_choice_committed": "第 {day} 天，你已选择：{choice}。",
  "console.order_prince.activate": "发动重投",
  "console.order_prince.decline": "不发动",
  "stage.order_prince_choice": "定序王子选择",
  "stage.order_prince_speech": "定序王子发言",
  "stage.order_prince_revote": "定序重投",
  "event.time_consort_lock_committed": "{actor}号第{day}夜封锁：{target}。",
  "event.time_consort_skipped_dead": "第{day}夜，{actor}号已死，不产生新的封锁。",
  "event.time_consort_skipped_exhausted":
    "第{day}夜，{actor}号的反弹已于此前夜晚生效，本局不再封锁。",
  "event.time_consort_reflected":
    "第{day}夜，{actor}号的封锁将{source}号对{target}号的{skill}反弹给{effective}号。",
  "time_consort.skill.check": "查验",
  "time_consort.skill.guard": "守护",
  "time_consort.skill.poison": "毒药",
  "role.time_wolf_consort.brief":
    "狼人阵营。每夜在好人技能前封锁一名存活者（可选自己），不能连续两夜封锁同一人，也可明确空过。好人的查验、守护、毒药作用于封锁目标时反弹给施法者自己；解药、狼刀不反弹。仅实际反弹消费整局技能，下一夜才获知耗尽。原请求目标仍用于连续目标限制。",
  "role.time_wolf_consort.scope_whole_night":
    "本板采用整夜范围：首次反弹后本夜后续合格技能仍反弹，后续夜失去技能。",
  "role.time_wolf_consort.scope_first_effect":
    "本板采用首次效果范围：首次反弹后本夜后续技能不再反弹，后续夜失去技能。",
  "action.lock_time.hint":
    "lock_time：合法 target_id 且 abstain=false；空过须 target_id=null 且 abstain=true。",
  "action.lock_time.directive": "只提交 lock_time。缺失、非法、晚到的选择失败，不自动空过。",
  "error.time_consort_unavailable": "蚀时狼妃当前不能封锁。",
  "error.time_consort_target": "请选择存活且与上一夜不同的目标，或明确空过。",
  "stage.time_consort_lock": "蚀时狼妃封锁",
  "replay.stage.time_consort_lock": "蚀时狼妃封锁",
  "replay.stage.time_consort_lock_committed": "封锁选择",
  "replay.stage.time_consort_lock_skipped": "跳过封锁",
  "replay.stage.time_consort_reflected": "封锁反弹",
  "prompt.config.scholar_mentor":
    "学者／导师规则：先判定免疫再判定冲突；两名施法者均免疫，村民没有可增减的技能。对免疫者、村民或发生冲突的合法施法仍消耗次数，明确空过不消耗。同一好人被两次有效施法会在黎明死亡，两效果取消但原生行动照常；两次有效施法均落在普通狼人时两效果取消、导师黎明死亡。增强预言家增加一次查验，增强守卫增加一次守护，增强女巫增加一瓶独立额外毒药（不补解药或原药库存），增强普通狼人由该狼人独自追加一刀。额外行动仅当夜有效，不能重复对应原生行动的目标；额外守护不受原生上一目标限制，也不改写该历史。削弱预言家或守卫会封锁其本夜原生技能；削弱女巫只禁毒药，保留解药；削弱任一普通狼人封锁全队本夜狼刀。女巫有解药时可见全部实际刀口，但仍只可用一瓶解药。双方不知道对方的选择；导师仅在夜初成为唯一存活狼人时继承刀权。",
  "role.day_scholar.brief":
    "白昼学者属于好人阵营。从第二夜起，每夜可增强或削弱一名存活玩家，整局增强、削弱各一次，也可空过。你不知道另一位施法者的选择；同一好人被两次施法会在天亮死亡，原生夜间行动仍完成。",
  "role.night_mentor.brief":
    "寂夜导师属于狼人阵营，其他狼人认识你，但你不认识狼队、不参与狼聊且不能自爆。仅当夜初只剩你一名狼人时获得刀权。从第二夜起，增强、削弱各可使用一次；两次施法都落在普通狼人时，两种效果取消，你在天亮死亡。",
  "action.modify_skill.hint":
    "mode 为 enhance、weaken 或 null；空过时 mode 和 target_id 都为 null。每种模式整局仅一次。",
  "action.modify_skill.directive":
    "现在选择本夜的增强、削弱或空过。只能选择请求列出的模式和存活目标。",
  "action.bonus_action.hint":
    "kind 必须与请求一致；额外行动不能重复本夜对应原生行动的目标。空过时 abstain=true、target_id=null。",
  "action.bonus_action.directive":
    "你获得一次仅本夜有效的额外行动。它独立于原生次数和药剂，不会恢复永久资源。选择候选目标或明确空过。",
  "error.modifier_unavailable": "当前不能使用此增减益或额外行动。",
  "error.modifier_target": "增减益模式、资源或目标不合法。",
  "prompt.stage.modifier_choice":
    "剩余可用模式：{modes}。只能选择一个模式与一个合法目标；空过时两项均为 null。",
  "prompt.stage.modifier_bonus":
    "本次额外行动类型为 {kind}。只能使用给出的候选；不能重复本夜对应原生行动的目标。",
  "stage.scholar_mentor_choice": "学者／导师施法",
  "stage.scholar_mentor_bonus": "强化额外行动",
  "replay.stage.scholar_mentor_choice": "学者／导师施法",
  "replay.stage.scholar_mentor_bonus": "强化额外行动",
  "replay.stage.modifier_choice_committed": "强化／削弱选择",
  "replay.stage.modifier_choice_skipped": "跳过施法",
  "replay.stage.modifier_conflict_resolved": "双施法冲突",
  "replay.stage.modifier_bonus_resolved": "额外行动结果",
  "prompt.stage.modifier_poison_blocked":
    "你本夜的原生毒药被削弱，不能使用毒药；解药仍按原规则使用，也可明确不用药。",
  "modifier.pass": "空过",
  "modifier.enhance": "强化",
  "modifier.weaken": "削弱",
  "modifier.first_night": "首夜不能施法",
  "modifier.dead": "已死亡",
  "modifier.exhausted": "次数耗尽",
  "modifier.same_good": "同一好人承受双施法",
  "modifier.both_wolves": "双方均对狼人施法",
  "modifier.check": "额外查验",
  "modifier.guard": "额外守护",
  "modifier.poison": "额外毒药",
  "modifier.kill": "额外狼刀",
  "modifier.result_wolf": "；查验结果：狼人阵营",
  "modifier.result_good": "；查验结果：好人阵营",
  "event.modifier_choice": "第 {day} 夜，{actor} 号选择{mode}，目标：{target}。",
  "event.modifier_skip": "第 {day} 夜，{actor} 号跳过施法：{reason}。",
  "event.modifier_conflict": "第 {day} 夜发生冲突：{kind}；{target} 号将在黎明结算死亡。",
  "event.modifier_bonus": "第 {day} 夜，{actor} 号的{skill}目标：{target}",
  "role.wolf_sorcerer.brief":
    "狼人座位映射者。魔术师之后、狼队行动之前，明确选择两个不同的未用存活编号或空过。每个号码自己整局只能使用一次。你的换位交换魔术师换位之后的座位占用者；重叠配对形成有序循环，相同配对抵消效果但不退还双方资源。身份、公开座位、白天票面不变。首次合法行动开始前不获知队友，也不参加狼队行动。",
  "role.wolf_sorcerer.first_night": "你的首次交换夜为第{day}夜。",
  "action.swap_night_seats.hint":
    "swap_night_seats：first_id、second_id 为两个不同合法编号且 abstain=false；空过须两目标均为 null 且 abstain=true。",
  "action.swap_night_seats.directive":
    "只提交 swap_night_seats。缺失、非法、晚到的必需选择失败，不自动空过。",
  "error.wolf_sorcerer_unavailable": "狼术师交换不属于当前可用行动窗口。",
  "error.wolf_sorcerer_target": "请选择两个不同的未用存活编号，或用两个 null 目标明确空过。",
  "stage.wolf_sorcerer_exchange": "狼术师交换",
  "replay.stage.wolf_sorcerer_exchange": "狼术师交换",
  "replay.stage.wolf_sorcerer_exchange_committed": "狼术师选择",
  "replay.stage.wolf_sorcerer_exchange_skipped": "狼术师跳过选择",
  "event.wolf_sorcerer_exchange_committed": "{actor}号第{day}夜的座位交换：{pair}。",
  "event.wolf_sorcerer_skipped_dead": "第{day}夜，{actor}号已死，不产生新的座位交换。",
  "event.wolf_sorcerer_skipped_not_started": "第{day}夜，{actor}号尚未到首次座位交换夜。",
  "event.wolf_sorcerer_skipped_exhausted": "第{day}夜，{actor}号未用存活号码不足两个，跳过交换。",
  "role.magician.sorcerer_rule":
    "狼术师组合中，后手换位交换你换位之后的座位占用者。相同号码对抵消效果，但不退还双方号码资源。",
  "role.trickster.brief":
    "狼人。狼队讨论前，选择两个不同且从未用过的存活编号（可选自己），只交换随后白天最终有效的放逐结果。身份、座位和原票不变。每个编号整局用一次；可明确空过，但不能连续两夜主动空过。合法编号不足两个时由引擎跳过耗尽技能。与魔术师同对时双方效果抵消，已用编号不返还。提交后的效果不因自己正常死亡回滚；映射对象已死时不额外放逐任何人。",
  "action.swap_exile_targets.hint":
    "swap_exile_targets：first_id、second_id 选两个不同且未用过的合法存活编号，abstain=false；允许主动空过时两目标同时为 null，abstain=true。",
  "action.swap_exile_targets.directive":
    "仅提交 swap_exile_targets，不能连续两夜主动空过。缺失、非法或晚到回应视为失败，不自动空过。",
  "error.trickster_unavailable": "诡术师选择不可用或不属于当前行动窗口。",
  "error.trickster_target":
    "须选择两个不同的合法未用编号；主动空过须两目标为 null 且本夜允许空过。",
  "stage.trickster_exchange": "诡术师交换",
  "replay.stage.trickster_exchange": "诡术师交换",
  "replay.stage.trickster_exchange_committed": "诡术师选择",
  "replay.stage.trickster_exchange_skipped": "诡术师跳过选择",
  "replay.stage.exile_target_mapped": "最终放逐映射",
  "role.magician.trickster_rule":
    "若本板含诡术师，同夜选择完全相同的编号对会抵消双方效果，但不返还双方已用编号。",
  "event.trickster_exchange_committed": "{actor}号第{day}夜的放逐交换选择：{pair}。",
  "event.trickster_skipped_dead": "第{day}夜，{actor}号已死，不产生新的放逐交换。",
  "event.trickster_skipped_exhausted": "第{day}夜，{actor}号未用存活编号不足两个，跳过交换。",
  "event.exile_target_mapped": "原票目标为{requested}号，实际放逐目标为{effective}号。",
  "event.exile_mapping_missed":
    "原票目标为{requested}号，映射目标{effective}号已死，本次不额外放逐。",
  "role.order_prince.brief":
    "好人神职。每天第一次放逐投票结束、放逐结算前，你可以翻牌发动一次重投；整局限一次。发动后先额外发言，再由当前合法选民重新投票；发言期间不可自爆。原票不再导致出局，警徽保留。首轮平票或全体弃票也可发动，PK 轮与重投轮不能再次发动。必须明确选择发动或不发动。",
  "action.reset_exile_vote.hint":
    "reset_exile_vote：activate=true 发动并消耗整局唯一技能；activate=false 明确不发动。",
  "action.reset_exile_vote.directive":
    "本轮只能提交 reset_exile_vote，必须明确给出 activate。缺失、失败或超时不能视为不发动。",
  "error.order_prince_unavailable": "重投技能不可用、已消耗或不属于当前首轮选择窗口。",
  "request.summary.order_prince_choice": "首轮放逐票已公布。请选择是否发动一次性重投技能。",
  "request.summary.order_prince_speech":
    "你已发动重投。请进行额外发言，随后重新投票；本窗口不能自爆。",
  "replay.stage.order_prince_choice_committed": "定序王子选择记录",
  "replay.stage.order_prince_revote_started": "定序王子发动重投",
  "replay.stage.order_prince_choice": "定序王子选择",
  "replay.stage.order_prince_speech": "定序王子发言",
  "replay.stage.order_prince_revote": "定序重投",
  "event.order_prince_revote_started": "{actor} 号翻牌为定序王子，废止本轮票并发动重投。",
  "role.magician.brief":
    "好人神职。每夜先选择两个不同的合法存活编号，交换它们当夜技能的生效目标；每个编号整局只能参与一次交换，可以选择自己，也可以明确弃用。交换不改变持久座位或身份。女巫仍获知原始刀口。",
  "role.magician.first_night": "本板从第{day}夜起可以交换。",
  "role.magician.shots_exchanged":
    "本板夜间死亡链中的开枪按当夜交换生效，白天死亡的枪不交换。若映射落点已死，消耗枪但不重复致死。开枪资格仍由原生死因策略决定。",
  "role.magician.shots_original": "本板死亡后的枪口不参与交换；开枪资格仍由原生死因策略决定。",
  "action.swap_targets.hint":
    "swap_targets：选择两个不同且从未用过的合法存活编号，abstain=false；明确弃用时 first_id 和 second_id 都为 null，abstain=true。",
  "action.swap_targets.directive":
    "本轮只能提交 swap_targets，选择两个当前合法候选或明确弃用。缺失、失败或超时响应不能作为弃用。",
  "stage.magician_exchange": "魔术师交换",
  "replay.stage.magician_exchange": "交换行动",
  "replay.stage.magician_exchange_committed": "交换选择",
  "error.magician_unavailable": "交换不可用、已经提交或不属于当前行动者。",
  "error.magician_target": "交换目标须为两个不同且未用过的合法存活编号；弃用须同时清空两个目标。",
  "console.magician.exchange": "{actor}号第{day}夜的交换选择：{pair}",
  "role.nightmare.brief":
    "狼人阵营。每夜先恐惧一名玩家，使其当夜不能行动；恐惧狼人则整队不能袭击。首夜恐惧前不与狼队互认。",
  "role.nightmare.state":
    "你是噩梦之影。恐惧在摄梦、狼聊和狼刀之前行动；不能选择自己、死亡玩家或连续两夜同一目标。首夜恐惧提交后与狼队互认，以后不能恐惧狼队友。被恐惧的预言家、女巫和摄梦人本夜不行动；猎人夜间死亡不能开枪，白天放逐仍可开枪。恐惧到狼人时全队本夜不能投刀，但仍可狼聊。不要推断未收到的角色或行动信息。",
  "role.nightmare.required": "本板有合法恐惧目标时必须选择；无合法目标时明确弃用。",
  "role.nightmare.optional": "本板允许明确弃用恐惧，弃用打断连续目标限制。",
  "role.nightmare.standard": "本板允许你按普通狼人规则自爆，也允许狼刀选择你。",
  "role.nightmare.no_blast": "本板禁止你自爆，所有狼刀都不能选择你；普通狼的自爆能力不受影响。",
  "action.fear.hint":
    "fear：选择合法存活编号且 abstain=false；明确弃用时 target_id=null 且 abstain=true。是否允许主动弃用以本板策略为准。",
  "action.fear.directive":
    "本轮只能提交 fear，按当前候选和板子策略选择目标或明确弃用，不能用缺失响应代替弃用。",
  "stage.nightmare_fear": "噩梦之影恐惧",
  "replay.stage.nightmare_fear": "恐惧行动",
  "replay.stage.red_moon_night_sealed": "赤月封夜",
  "replay.stage.red_moon_exile_delayed": "赤月延期放逐",
  "replay.stage.red_moon_delay_expired": "赤月到期死亡",
  "replay.stage.nightmare_fear_committed": "恐惧选择",
  "error.nightmare_unavailable": "本夜恐惧不可用、已提交或不属于当前行动者。",
  "error.nightmare_target": "恐惧目标或弃用不符合本板策略。",
  "console.nightmare.fear": "{actor}号第{day}夜的恐惧选择：{target}",
  "role.evil_knight.brief":
    "狼人阵营，参与狼聊与狼刀，不能自爆且不能成为狼刀目标。夜间免疫，并有整局一次验毒反伤。",
  "role.evil_knight.state":
    "你是恶夜骑士，参与狼聊与狼刀，不能自爆，所有狼人都不能对你投刀。夜间免疫不随反伤次数耗尽而消失。剩余反伤次数：{remaining}。首次合法预言家查验或女巫毒药触发一次反伤，施法者在整夜统一结算时死亡；守护和解药不能抵挡反伤。查验仍报告狼人，毒药仍消耗。AWA 本板女巫先于预言家行动，同夜验毒时毒药先触发；守护与治疗本身不触发反伤。不要推断未收到的行动或公开身份。",
  "role.evil_knight.gun_immune": "本板夜间死亡连锁的猎枪不能杀死你；白天放逐引发的猎枪可以。",
  "role.evil_knight.gun_bypasses":
    "本板采用猎枪例外策略：猎人合法开枪可以杀死你，包括夜间死亡连锁。",
  "role.pure_white_girl.brief":
    "好人神职。每夜查验另一名存活玩家的具体身份；第二夜起验到狼人还会在夜间统一结算时将其验杀，允许跨夜重复查验。",
  "role.wolf_witch.brief":
    "狼人阵营，参与狼聊及狼刀。每夜在纯白之女之后查验另一名存活非狼玩家的具体身份；第二夜起仅验到纯白之女时将其验杀。",
  "role.pure_white_girl.state":
    "你是纯白之女，属于好人神职。每夜女巫之后使用 inspect_night_identity 查验另一名存活玩家，或明确放弃；允许跨夜重复查验。具体身份报告仅你可见。首夜查验不造成伤害；第二夜起验到狼人会产生独立验杀伤害，在整夜统一结算，普通守护与解药不能抵挡。待结算的狼刀或毒药不提前剥夺你的行动。不要捏造报告、公开身份或即时死亡；同时达成双方淘汰条件时遵循板子公布的胜负优先级。",
  "role.wolf_witch.state":
    "你是狼巫，属于狼人阵营，参与普通狼聊及狼刀投票，可自刀并在板子允许的窗口自爆。每夜在纯白之女之后使用 inspect_night_identity 查验另一名存活非狼玩家，或明确放弃；允许重复查验。具体身份报告仅你可见。首夜不造成查验伤害；第二夜起只有验到纯白之女才产生独立验杀伤害，在整夜统一结算，普通守护与解药不能抵挡，验到其它身份不会因此杀死对方。报告不自动分享给其它狼人，也不能回改本夜狼刀；你可在后续合法发言中主动分享。待结算狼刀或毒药不提前剥夺你的行动。同时达成双方淘汰条件时遵循板子公布的胜负优先级。",
  "prompt.board.pure_white.wolf_priority":
    "纯白板规则：整夜死亡及其引发的开枪全部结算后，才公布死亡并检查胜负；游戏继续时再进行警长竞选。若同一检查点狼人全灭且神职全灭或平民全灭同时成立，判狼人胜；其余情况按普通屠边目标判定。",
  "prompt.board.pure_white.good_priority":
    "纯白板规则：整夜死亡及其引发的开枪全部结算后，才公布死亡并检查胜负；游戏继续时再进行警长竞选。若同一检查点狼人全灭且神职全灭或平民全灭同时成立，本板选用的 AWA 变体判好人胜；其余情况按普通屠边目标判定。",
  "action.inspect_night_identity.hint":
    "查验另一名存活玩家：target_id 填整数编号且 abstain:false；明确放弃则 target_id:null 且 abstain:true。狼巫不得查验狼人阵营玩家，允许跨夜重复查验同一目标。",
  "stage.pure_white_girl": "纯白之女查验",
  "stage.wolf_witch": "狼巫查验",
  "action.inspect_role.hint":
    "inspect_role：target_id为其它当前存活玩家的整数编号；不可self/null/dead，重复限制以本轮绑定实例规则为准。",
  "stage.role_inspection": "具体角色查验",
  "error.role_inspection_unavailable": "本角色查验实例当前不可用或本夜已行动。",
  "error.role_inspection_target": "请选择其它当前存活玩家。",
  "error.role_inspection_repeat": "本实例已查验过该玩家编号，不能重复查验。",
  "prompt.config.magician.first_night": "魔术师从第{day}夜起可以交换。",
  "prompt.config.magician.shots_exchanged":
    "魔术师的夜间交换影响夜死连锁的枪口；白天死亡的枪口不交换，开枪资格仍按原生死因策略。",
  "prompt.config.magician.shots_original":
    "魔术师的交换不影响死亡后的枪口；开枪资格仍按原生死因策略。",
  "prompt.config.wolf_sorcerer.first_night": "狼术师从第{day}夜起可以交换。",
  "prompt.config.time_wolf_consort.scope_first_effect":
    "蚀时狼妃采用首次效果范围：首次反弹后本夜后续技能不再反弹，后续夜失去技能。",
  "prompt.config.time_wolf_consort.scope_whole_night":
    "蚀时狼妃采用整夜范围：首次反弹后本夜后续合格技能仍反弹，后续夜失去技能。",
  "prompt.config.red_moon_apostle.last_wolf_forbidden":
    "赤月使徒作为最后一名狼人时不能自爆；普通狼人权限不变。",
  "prompt.config.red_moon_apostle.last_wolf_ends":
    "赤月使徒作为最后一名狼人时可以自爆；完整死亡链结束后按胜利规则判胜，普通狼人权限不变。",
  "prompt.config.nightmare.required": "噩梦之影有合法恐惧目标时必须选择；无合法目标时明确弃用。",
  "prompt.config.nightmare.optional": "噩梦之影可以明确弃用恐惧；弃用打断连续目标限制。",
  "prompt.config.nightmare.standard": "噩梦之影可以按普通狼人规则自爆，也能成为狼刀目标。",
  "prompt.config.nightmare.no_blast": "噩梦之影不能自爆，也不能成为狼刀目标；普通狼人仍可自爆。",
  "prompt.config.evil_knight.gun_bypasses":
    "恶夜骑士可被合格的猎人枪杀死，包括夜间死亡连锁中的枪。",
  "prompt.config.evil_knight.gun_immune":
    "恶夜骑士免疫夜间死亡连锁的猎人枪；白天放逐引发的猎人枪可将其杀死。",
} as const satisfies Record<keyof typeof definition.parameters, string>;

export const en = {
  "role.demon_hunter.brief":
    "NetEase rule adapted to the named finite AWA board: from night two, choose at most one other living player each night or explicitly abstain. A true wolf dies at dawn; hunting a Good player kills you instead. Native Witch poison cannot kill you. Guard and Heal do not stop hunt or backlash. No target camp or poison outcome is disclosed to you.",
  "role.demon_hunter.state":
    "Your original hunt history: {state}. Each new eligible night permits one new choice, with no total stock limit; a past target may be chosen again.",
  "action.demon_hunt.hint":
    "From night two submit exactly target_id as another living player's integer ID with abstain=false, or target_id=null with abstain=true. This required response has no fallback; self and dead targets are forbidden.",
  "stage.demon_hunter": "Demon Hunter choice",
  "console.demon_hunter.chosen": "God: Demon Hunter {actor} chose {target} on night {day}.",
  "console.demon_hunter.own": "Your hunt choice on night {day}: {target}.",
  "console.demon_hunter.cancelled":
    "God: the committed hunt by Demon Hunter {actor} on {target} was revoked on night {day}; fault {fault}.",
  "console.demon_hunter.poison_immune":
    "God: Demon Hunter {actor} is immune to this original Witch {witch} toxin contribution on night {day}.",
  "replay.stage.demon_hunter_chosen": "Hunt choice",
  "replay.stage.demon_hunter_cancelled": "Revoked hunt",
  "replay.stage.demon_hunter_poison_immune": "Native toxin immunity",
  "death.evil_knight_reflection": "Dark Knight retaliation",
  "death.pure_white_inspection": "Pure White inspection",
  "death.wolf_witch_inspection": "Wolf Witch inspection",
  "death.demon_hunt": "Demon Hunt",
  "death.demon_hunt_backlash": "Demon Hunt backlash",
  "death.red_moon_expiry": "Red Moon delayed death",
  "console.red_moon.seal":
    "Red Moon Apostle #{actor} self-destructed; good abilities are sealed on night {night}.",
  "console.red_moon.exile":
    "Red Moon Apostle #{actor} was exiled; death is delayed until night {night} settles.",
  "console.red_moon.expiry":
    "On night {day}, Red Moon Apostle #{actor}'s delayed death took effect.",
  "console.role_inspection.skipped":
    "Player {actor} ends the inspection opportunity on night {day}: {reason}",
  "replay.stage.role_inspection_skipped": "Inspection pass",
  "console.nightmare.own": "Your fear choice on night {day}: {target}",
  "console.nightmare.pass": "pass",
  "role.red_moon_apostle.brief":
    "You are the Red Moon Apostle, a werewolf. Self-destruction seals good players' abilities for the next night. If exiled as the last living werewolf, your death is deferred until the next dawn.",
  "role.red_moon_apostle.state":
    "Self-destruction day: {blastDay}; deferred-exile day: {exileDay}.",
  "role.red_moon_apostle.last_wolf_forbidden":
    "You cannot self-destruct as the last living wolf; ordinary wolves retain their usual permissions.",
  "role.red_moon_apostle.last_wolf_ends":
    "You may self-destruct as the last living wolf; victory is judged after the complete death chain with no wolves remaining. Ordinary wolves retain their usual permissions.",
  "console.magician.pass": "pass",
  "console.magician.own": "Your exchange choice on night {day}: {pair}",
  "role.magician.heal_rule":
    "Witch self-heal permission is based on the original knife number: she cannot heal when that number is herself; an allowed heal of another number still works when exchanged onto herself.",
  "event.order_prince_choice_committed": "Day {day}: your choice was recorded: {choice}.",
  "console.order_prince.activate": "activate the reset",
  "console.order_prince.decline": "decline",
  "stage.order_prince_choice": "Order Prince choice",
  "stage.order_prince_speech": "Order Prince speech",
  "stage.order_prince_revote": "Restarted exile vote",
  "event.time_consort_lock_committed": "Player {actor}'s night {day} lock: {target}.",
  "event.time_consort_skipped_dead": "Night {day}: player {actor} is dead; no new lock.",
  "event.time_consort_skipped_exhausted":
    "Night {day}: player {actor}'s reflection was consumed on an earlier night; no further locks.",
  "event.time_consort_reflected":
    "Night {day}: player {actor}'s lock reflects player {source}'s {skill} from player {target} to player {effective}.",
  "time_consort.skill.check": "inspection",
  "time_consort.skill.guard": "guard",
  "time_consort.skill.poison": "poison",
  "role.time_wolf_consort.brief":
    "Werewolf. Before good night skills, lock one living player, including yourself, or explicitly pass. Do not lock the same player on consecutive nights. Good inspection, guard and poison aimed at the locked player affect their own caster; heal and wolf attack do not reflect. Only an actual reflection consumes the game-long skill, and exhaustion is disclosed next night. Original requests still govern consecutive-target legality.",
  "role.time_wolf_consort.scope_whole_night":
    "Whole-night scope: after the first reflection, later eligible skills still reflect this night; no locks on later nights.",
  "role.time_wolf_consort.scope_first_effect":
    "First-effect scope: after the first reflection, later skills do not reflect; no locks on later nights.",
  "action.lock_time.hint":
    "lock_time: legal target_id with abstain=false; pass with target_id=null and abstain=true.",
  "action.lock_time.directive":
    "Submit only lock_time. Missing, invalid or late choices fail and never become automatic passes.",
  "error.time_consort_unavailable": "The Time-Wolf Consort cannot lock a target now.",
  "error.time_consort_target":
    "Choose a living target different from last night, or explicitly pass.",
  "stage.time_consort_lock": "Time-Wolf Consort lock",
  "replay.stage.time_consort_lock": "Time-Wolf Consort lock",
  "replay.stage.time_consort_lock_committed": "Lock choice",
  "replay.stage.time_consort_lock_skipped": "Skipped lock",
  "replay.stage.time_consort_reflected": "Lock reflection",
  "prompt.config.scholar_mentor":
    "Scholar / Mentor rules: apply immunity before conflicts. Both casters are immune; Villagers have no skill to modify. A valid cast on an immune player, a Villager, or a conflicting target still spends its charge; explicit passes do not. Two effective casts on the same good player cancel both effects and cause death at dawn, while native actions still proceed. Two effective casts on ordinary wolves cancel both effects and kill the Mentor at dawn. Enhancement gives the Seer one extra inspection, the Guard one extra guard, the Witch one independent bonus poison (no refill of heal or native potions), or the selected ordinary wolf one individual extra knife. Bonuses last only this night and cannot repeat their corresponding native target; bonus guard ignores and does not overwrite native previous-target history. Weakening blocks the Seer or Guard native skill for the night. Weakening the Witch blocks only poison and preserves heal; weakening any ordinary wolf blocks the entire pack knife that night. A Witch with heal sees all actual knife targets but still has only one heal. Neither caster learns the other choice; the Mentor inherits the knife only when the sole living wolf at night start.",
  "role.day_scholar.brief":
    "Day Scholar is good. From night two, enhance or weaken one living player, with one charge of each for the entire game, or pass. You do not learn the other caster's choice. Two casts on the same good player cause death at dawn but do not cancel their native night action.",
  "role.night_mentor.brief":
    "Night Mentor is a wolf. The pack recognizes you, but you do not know the pack, cannot join wolf chat or self-destruct. You inherit the knife only when you are the sole wolf at night start. From night two, you have one enhance and one weaken charge. If both casts target ordinary wolves, both effects are cancelled and you die at dawn.",
  "action.modify_skill.hint":
    "Use enhance, weaken, or null for mode. To pass, both mode and target_id must be null. Each mode has one charge for the entire game.",
  "action.modify_skill.directive":
    "Choose this night's enhancement, weakening, or pass. Use only an available mode and a listed living target.",
  "action.bonus_action.hint":
    "kind must match the request. A bonus action cannot repeat the corresponding native target tonight. To pass, set abstain=true and target_id=null.",
  "action.bonus_action.directive":
    "You have one bonus action for this night only. It is separate from native uses and potions and does not refill permanent resources. Choose a listed target or explicitly pass.",
  "error.modifier_unavailable": "This modifier or bonus action is unavailable.",
  "error.modifier_target": "Invalid modifier mode, resource, or target.",
  "prompt.stage.modifier_choice":
    "Remaining modes: {modes}. Select one mode and one legal target, or set both to null to pass.",
  "prompt.stage.modifier_bonus":
    "This bonus action is {kind}. Use the supplied candidates; do not repeat this night's corresponding native target.",
  "stage.scholar_mentor_choice": "Scholar / Mentor modifier",
  "stage.scholar_mentor_bonus": "Enhanced bonus action",
  "replay.stage.scholar_mentor_choice": "Scholar / Mentor modifier",
  "replay.stage.scholar_mentor_bonus": "Enhanced bonus action",
  "replay.stage.modifier_choice_committed": "Modifier choice",
  "replay.stage.modifier_choice_skipped": "Skipped modifier",
  "replay.stage.modifier_conflict_resolved": "Modifier conflict",
  "replay.stage.modifier_bonus_resolved": "Bonus action result",
  "prompt.stage.modifier_poison_blocked":
    "Your native poison is weakened tonight and cannot be used. Healing follows its normal rules; you may explicitly use no potion.",
  "modifier.pass": "pass",
  "modifier.enhance": "enhance",
  "modifier.weaken": "weaken",
  "modifier.first_night": "unavailable on the first night",
  "modifier.dead": "dead",
  "modifier.exhausted": "charges exhausted",
  "modifier.same_good": "both modifiers targeted the same good player",
  "modifier.both_wolves": "both modifiers targeted werewolves",
  "modifier.check": "bonus inspection",
  "modifier.guard": "bonus guard",
  "modifier.poison": "bonus poison",
  "modifier.kill": "bonus wolf attack",
  "modifier.result_wolf": "; result: werewolf camp",
  "modifier.result_good": "; result: good camp",
  "event.modifier_choice": "Night {day}: player {actor} chose {mode}; target: {target}.",
  "event.modifier_skip": "Night {day}: player {actor} skipped their modifier: {reason}.",
  "event.modifier_conflict":
    "Night {day}: modifier conflict ({kind}); player {target} is scheduled to die at dawn.",
  "event.modifier_bonus": "Night {day}: player {actor}'s {skill} target: {target}",
  "role.wolf_sorcerer.brief":
    "Werewolf seat mapper. After the Magician and before pack actions, explicitly choose two distinct unused living numbers or pass. Each of your numbers can be used once. Your swap moves the occupants of the already-swapped positions; overlapping pairs form an ordered cycle, while identical pairs cancel effects without refunding resources. Identities, public seats and daytime ballots remain unchanged. No pack knowledge or action before your first eligible choice.",
  "role.wolf_sorcerer.first_night": "Your first exchange night is {day}.",
  "action.swap_night_seats.hint":
    "swap_night_seats: two distinct legal first_id/second_id with abstain=false; to pass, both targets must be null and abstain=true.",
  "action.swap_night_seats.directive":
    "Submit only swap_night_seats. Missing, invalid and late required choices fail; they are not automatic passes.",
  "error.wolf_sorcerer_unavailable": "The Wolf Sorcerer exchange is unavailable in this turn.",
  "error.wolf_sorcerer_target":
    "Choose two distinct unused living numbers, or explicitly pass with both targets null.",
  "stage.wolf_sorcerer_exchange": "Wolf Sorcerer exchange",
  "replay.stage.wolf_sorcerer_exchange": "Wolf Sorcerer exchange",
  "replay.stage.wolf_sorcerer_exchange_committed": "Wolf Sorcerer choice",
  "replay.stage.wolf_sorcerer_exchange_skipped": "Wolf Sorcerer skipped choice",
  "event.wolf_sorcerer_exchange_committed": "Player {actor}'s night {day} seat exchange: {pair}.",
  "event.wolf_sorcerer_skipped_dead": "Night {day}: player {actor} is dead; no new seat exchange.",
  "event.wolf_sorcerer_skipped_not_started":
    "Night {day}: player {actor}'s seat exchange has not started.",
  "event.wolf_sorcerer_skipped_exhausted":
    "Night {day}: player {actor} has fewer than two unused living numbers; the exchange is skipped.",
  "role.magician.sorcerer_rule":
    "On the Wolf Sorcerer board, their later swap exchanges occupants of positions after your swap. Identical pairs cancel effects but never refund either inventory.",
  "role.trickster.brief":
    "Werewolf. Before pack discussion, choose two distinct unused living numbers, including yourself if desired, to exchange only the next day's final exile outcome. Seats, identities and ballots stay unchanged. Each number is used once; you may explicitly pass, but never on consecutive nights. With fewer than two legal numbers the engine skips the exhausted skill. An identical Magician pair cancels both effects without refunding numbers. Submitted effects survive your ordinary death; an already-dead mapped target causes no additional exile.",
  "action.swap_exile_targets.hint":
    "swap_exile_targets: first_id and second_id must be distinct legal unused living numbers, with abstain=false. A permitted explicit pass sets both to null and abstain=true.",
  "action.swap_exile_targets.directive":
    "Submit only swap_exile_targets. Do not pass on consecutive nights. Missing, invalid or late responses fail rather than becoming passes.",
  "error.trickster_unavailable":
    "The Trickster choice is unavailable or outside your current turn.",
  "error.trickster_target":
    "Choose two distinct legal unused numbers; passing requires two null targets and permission to pass.",
  "stage.trickster_exchange": "Trickster exchange",
  "replay.stage.trickster_exchange": "Trickster exchange",
  "replay.stage.trickster_exchange_committed": "Trickster choice",
  "replay.stage.trickster_exchange_skipped": "Trickster skipped choice",
  "replay.stage.exile_target_mapped": "Final exile mapping",
  "role.magician.trickster_rule":
    "If this board includes a Trickster, identical pairs cancel both effects without refunding either role's used numbers.",
  "event.trickster_exchange_committed":
    "Player {actor}'s night {day} exile exchange choice: {pair}.",
  "event.trickster_skipped_dead": "Night {day}: player {actor} is dead; no new exile exchange.",
  "event.trickster_skipped_exhausted":
    "Night {day}: player {actor} has fewer than two unused living numbers; the exchange is skipped.",
  "event.exile_target_mapped": "Ballot winner: {requested}; actual exile target: {effective}.",
  "event.exile_mapping_missed":
    "Ballot winner: {requested}; mapped target {effective} is already dead. Nobody else is exiled.",
  "role.order_prince.brief":
    "Good faction, god role. After the first exile ballot each day and before exile resolution, you may reveal and restart the vote once per game. Give an extra speech, then all currently eligible voters vote again. No self-destruct window opens during this speech. The old ballot causes no exile and the sheriff badge stays. A tied or all-abstention first ballot is eligible; PK and restarted ballots cannot trigger the skill again. Explicitly activate or decline.",
  "action.reset_exile_vote.hint":
    "reset_exile_vote: activate=true spends your once-per-game skill; activate=false explicitly declines.",
  "action.reset_exile_vote.directive":
    "Submit only reset_exile_vote with an explicit activate boolean. Missing, failed or timed-out responses never count as declining.",
  "error.order_prince_unavailable":
    "The reset is unavailable, spent, or outside your current first-ballot choice.",
  "request.summary.order_prince_choice":
    "The first exile ballot is public. Decide whether to spend your one-use vote reset.",
  "request.summary.order_prince_speech":
    "You have activated the reset. Give your extra speech before the new ballot. Self-destruct is unavailable here.",
  "replay.stage.order_prince_choice_committed": "Order Prince choice receipt",
  "replay.stage.order_prince_revote_started": "Order Prince vote reset",
  "replay.stage.order_prince_choice": "Order Prince choice",
  "replay.stage.order_prince_speech": "Order Prince speech",
  "replay.stage.order_prince_revote": "Restarted exile vote",
  "event.order_prince_revote_started":
    "Player {actor} reveals as the Order Prince, voids this ballot and starts a new vote.",
  "role.magician.brief":
    "Good faction, god role. Act first each eligible night to exchange the effective targets of night skills for two distinct legal living numbers. Each number can be used only once per game; you may include yourself or explicitly pass. Persistent seats and identities do not move. The Witch still sees the original knife target.",
  "role.magician.first_night": "Exchanges are available starting on night {day}.",
  "role.magician.shots_exchanged":
    "Shots in the night-death chain use that night's exchange; shots caused by daytime deaths do not. A mapped target already dead consumes the shot without another death. Original cause-based rules still determine shot eligibility.",
  "role.magician.shots_original":
    "Death shots do not use the exchange. Original cause-based rules still determine shot eligibility.",
  "action.swap_targets.hint":
    "swap_targets: choose two distinct, unused, legal living numbers with abstain=false. To explicitly pass, set both first_id and second_id to null and abstain=true.",
  "action.swap_targets.directive":
    "Submit only swap_targets with two current legal candidates or an explicit pass. Missing, failed, or timed-out responses never count as passing.",
  "stage.magician_exchange": "Magician exchange",
  "replay.stage.magician_exchange": "Exchange action",
  "replay.stage.magician_exchange_committed": "Exchange choice",
  "error.magician_unavailable":
    "The exchange is unavailable, already committed, or owned by another actor.",
  "error.magician_target":
    "Choose two distinct unused legal living numbers, or clear both targets to pass.",
  "console.magician.exchange": "Player {actor}'s exchange choice on night {day}: {pair}",
  "role.nightmare.brief":
    "Wolf faction. Act first each night to silence one player for that night; fearing a wolf blocks the entire pack attack. Pack identities are hidden until the first fear commits.",
  "role.nightmare.state":
    "You are the Nightmare Shadow. Fear acts before dreaming, wolf chat and the knife. Do not target yourself, dead players, or the same player on consecutive nights. You learn the pack after your first fear commits and cannot fear teammates thereafter. A feared Seer, Witch or Dreamer does not act that night. A feared Hunter cannot shoot after a night death but can after a daytime exile. Fearing a wolf blocks the whole pack knife, not wolf chat. Do not infer identities or actions you have not received.",
  "role.nightmare.required":
    "Choose a fear target whenever one is legal; explicitly pass only when none is legal.",
  "role.nightmare.optional":
    "You may explicitly pass. A passed night breaks the consecutive-target restriction.",
  "role.nightmare.standard":
    "You may self-destruct under ordinary wolf rules and the pack may target you with its knife.",
  "role.nightmare.no_blast":
    "You cannot self-destruct and no pack knife may target you. Ordinary wolves keep their self-destruct ability.",
  "action.fear.hint":
    "fear: use a legal living target_id with abstain=false, or target_id=null with abstain=true to explicitly pass when the board policy permits.",
  "action.fear.directive":
    "Submit only fear, choosing a current legal target or an explicitly permitted pass. A missing response is never a pass.",
  "stage.nightmare_fear": "Nightmare fear",
  "replay.stage.nightmare_fear": "Fear action",
  "replay.stage.red_moon_night_sealed": "Red Moon night seal",
  "replay.stage.red_moon_exile_delayed": "Red Moon deferred exile",
  "replay.stage.red_moon_delay_expired": "Red Moon expiry",
  "replay.stage.nightmare_fear_committed": "Fear choice",
  "error.nightmare_unavailable":
    "Fear is unavailable, already committed, or owned by another actor.",
  "error.nightmare_target": "The fear target or pass does not satisfy this board's policy.",
  "console.nightmare.fear": "Player {actor}'s fear choice on night {day}: {target}",
  "role.evil_knight.brief":
    "Wolf with pack chat and knife rights. Cannot self-destruct or be a pack-knife target. Persistent night immunity and one retaliation against Seer checks or Witch poison.",
  "role.evil_knight.state":
    "You are Dark Knight. Join pack chat and knife voting, but never self-destruct; no wolf may knife you. Night immunity persists after retaliation is spent. Retaliations remaining: {remaining}. The first accepted native Seer check or Witch poison triggers one retaliation, killing its caster at simultaneous night settlement despite guard or healing. The Seer still learns Wolf and the Witch still spends poison. This AWA board runs Witch before Seer, so poison takes priority when both act that night. Guard and healing alone never trigger retaliation. Do not infer unreceived actions or public role reveals.",
  "role.evil_knight.gun_immune":
    "This board blocks Hunter shots originating from the night death chain. Shots following daytime exile can kill you.",
  "role.evil_knight.gun_bypasses":
    "This board uses the Hunter-shot exception: a qualified Hunter shot can kill you, including in a night death chain.",
  "role.pure_white_girl.brief":
    "Good god. Inspect another living player's exact role each night; from night two, inspecting a wolf also kills that player at night settlement. Repeated targets are allowed.",
  "role.wolf_witch.brief":
    "Wolf with pack chat and knife rights. After Pure White Girl, inspect another living non-wolf player's exact role; from night two, inspecting Pure White Girl also kills her at night settlement.",
  "role.pure_white_girl.state":
    "You are Pure White Girl, a Good god. After Witch each night, use inspect_night_identity on another living player, or explicitly pass. Repeated targets across nights are legal. Only you receive the exact role report. Night one never causes inspection damage; from night two, inspecting a wolf causes independent inspection damage at simultaneous night settlement, unaffected by ordinary guard or healing. Pending knife or poison does not remove your action. Never infer an extra report, a public role reveal, or an immediate death. Follow the board's published simultaneous-elimination priority.",
  "role.wolf_witch.state":
    "You are Wolf Witch, on the Wolf team. You participate in ordinary pack chat and knife voting, may self-vote for the knife, and may self-destruct in the board's enabled windows. After Pure White Girl each night, use inspect_night_identity on another living non-wolf player, or explicitly pass; repeats are legal. Only you receive the exact role report. Night one never causes inspection damage; from night two, only inspecting Pure White Girl causes independent inspection damage at simultaneous settlement, unaffected by guard or healing. Other inspected roles survive this ability. Reports are not automatically shared with wolves and cannot retroactively change this night's knife; you may share them in later legal speech. Pending knife or poison does not remove your action. Follow the board's published simultaneous-elimination priority.",
  "prompt.board.pure_white.wolf_priority":
    "Pure White board: resolve all night deaths and resulting shots before announcing deaths and checking victory; the sheriff election follows if the game continues. If all wolves and either all gods or all villagers are eliminated at the same checkpoint, Wolves win. Otherwise use ordinary side-elimination goals.",
  "prompt.board.pure_white.good_priority":
    "Pure White board: resolve all night deaths and resulting shots before announcing deaths and checking victory; the sheriff election follows if the game continues. If all wolves and either all gods or all villagers are eliminated at the same checkpoint, this AWA variant awards Good the win. Otherwise use ordinary side-elimination goals.",
  "action.inspect_night_identity.hint":
    "Inspect another living player with an integer target_id and abstain:false, or explicitly pass with target_id:null and abstain:true. Wolf Witch cannot inspect a wolf-camp player. Repeat targets across nights are allowed.",
  "stage.pure_white_girl": "Pure White Girl inspection",
  "stage.wolf_witch": "Wolf Witch inspection",
  "action.inspect_role.hint":
    "inspect_role: target_id is another currently living integer player ID. No self/null/dead target; follow this bound instance's repetition rule.",
  "stage.role_inspection": "Role inspection",
  "error.role_inspection_unavailable":
    "This role inspection instance is unavailable or already acted tonight.",
  "error.role_inspection_target": "Choose another currently living player.",
  "error.role_inspection_repeat":
    "This instance already inspected that player ID; do not repeat it.",
  "prompt.config.magician.first_night": "Magician exchanges are available starting on night {day}.",
  "prompt.config.magician.shots_exchanged":
    "Magician exchanges affect shots in night death chains; daytime death shots are not exchanged. Native death-source eligibility still applies.",
  "prompt.config.magician.shots_original":
    "Magician exchanges do not affect death-shot targets. Native death-source eligibility still applies.",
  "prompt.config.wolf_sorcerer.first_night":
    "Wolf Sorcerer exchanges are available starting on night {day}.",
  "prompt.config.time_wolf_consort.scope_first_effect":
    "Time Wolf Consort reflects only the first eligible effect that night and loses the skill on later nights.",
  "prompt.config.time_wolf_consort.scope_whole_night":
    "Time Wolf Consort keeps reflecting eligible effects throughout the first triggered night and loses the skill on later nights.",
  "prompt.config.red_moon_apostle.last_wolf_forbidden":
    "Red Moon Apostle cannot self-destruct as the last living wolf; ordinary wolves retain their usual permissions.",
  "prompt.config.red_moon_apostle.last_wolf_ends":
    "Red Moon Apostle may self-destruct as the last living wolf; victory is judged after the complete death chain. Ordinary wolves retain their usual permissions.",
  "prompt.config.nightmare.required":
    "Nightmare Shadow must choose a legal fear target whenever one exists and explicitly pass otherwise.",
  "prompt.config.nightmare.optional":
    "Nightmare Shadow may explicitly pass fear; a pass breaks the consecutive-target restriction.",
  "prompt.config.nightmare.standard":
    "Nightmare Shadow may self-destruct under ordinary wolf rules and may be targeted by the pack knife.",
  "prompt.config.nightmare.no_blast":
    "Nightmare Shadow cannot self-destruct or be targeted by the pack knife. Ordinary wolves may still self-destruct.",
  "prompt.config.evil_knight.gun_bypasses":
    "Dark Knight can be killed by an eligible Hunter shot, including a shot in a night death chain.",
  "prompt.config.evil_knight.gun_immune":
    "Dark Knight is immune to Hunter shots in night death chains; shots following daytime exile can kill Dark Knight.",
} satisfies Record<keyof typeof definition.parameters, string>;

export const messages = { definition, zhCN, en };
