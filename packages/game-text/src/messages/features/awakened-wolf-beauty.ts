/**
 * 负责觉醒狼美人的秘密选择、冷却与一次替死的双语模板。输入稳定键和惰性参数，输出自然文案。
 * 付款、提案和真实死亡分别表述；不读取World、推断受众或翻译玩家原文。
 */
import type { MessageDefinition } from "../definition";
export const definition = {
  owner: "features/awakened-wolf-beauty",
  parameters: {
    "role.awakened_wolf_beauty.brief": [],
    "role.awakened_wolf_beauty.state": ["choices", "resource"],
    "awakened_beauty.resource.ready": [],
    "awakened_beauty.resource.spent": [],
    "awakened_beauty.choice": ["day", "target"],
    "awakened_beauty.pass": ["day"],
    "action.awakened_charm.hint": [],
    "action.awakened_charm.directive": [],
    "stage.awakened_charm": [],
    "request.summary.awakened_charm": [],
    "prompt.config.awakened_wolf_beauty": [],
    "prompt.stage.awakened_charm_candidates": ["ids"],
    "event.awakened_charm_chosen": ["actor", "day", "next", "target"],
    "event.awakened_charm_passed": ["actor", "day"],
    "event.awakened_beauty_replacement_paid": ["actor", "causes", "day", "phase", "root", "target"],
    "event.awakened_beauty_replaced": ["actor", "day", "target"],
    "event.awakened_beauty_replacement_blocked": ["actor", "day", "target"],
    "replay.stage.awakened_charm_chosen": [],
    "replay.stage.awakened_beauty_replacement_paid": [],
    "replay.stage.awakened_beauty_replaced": [],
    "death.awakened_beauty_replacement": [],
  },
} as const satisfies MessageDefinition;
export const zhCN = {
  "role.awakened_wolf_beauty.brief":
    "觉醒狼美人属于狼队，可狼聊与刀票，不能自爆或自刀。狼刀后可魅惑另一活人；非空选择后隔一夜才能再选，旧关系在下个真实开夜到期。全局一次替死只在原目标仍活且本次来源允许时消费，自己保持原生命。夜间死亡发起的觉醒猎人巡猎禁本次替死；白天根巡猎允许替死。队友和目标不知道你的秘密选择。",
  "role.awakened_wolf_beauty.state": "替死资源：{resource}。本人已选历史：{choices}。",
  "awakened_beauty.resource.ready": "尚未消费",
  "awakened_beauty.resource.spent": "已经消费，不再补发",
  "awakened_beauty.choice": "第{day}夜选择{target}号，关系仅该夜及后续白天有效",
  "awakened_beauty.pass": "第{day}夜明确空过",
  "action.awakened_charm.hint":
    "target_id仅可选本轮候选中的另一玩家，或null明确空过。空过不消费替死，也不设置隔夜冷却；不能选自己。",
  "action.awakened_charm.directive":
    "只用awakened_charm提交本轮秘密魅惑选择；缺失、迟到或撤权不是null空过。",
  "stage.awakened_charm": "觉醒狼美人魅惑",
  "request.summary.awakened_charm": "选择本夜魅惑目标或明确空过",
  "prompt.config.awakened_wolf_beauty":
    "本板采用AWA觉醒狼美人一次替死政策：非空魅惑隔夜使用、每夜关系到下个开夜到期，不自爆／自刀。原目标不可同波独立致死，夜根巡猎禁本次替死；替死保活者不移徽、不发遗言，真正死亡另行结算。",
  "prompt.stage.awakened_charm_candidates": "本轮秘密魅惑候选：{ids}。候选不是身份或提交许可。",
  "event.awakened_charm_chosen":
    "第{day}夜，{actor}号秘密魅惑{target}号；下次最早第{next}夜可选，尚未消费替死。",
  "event.awakened_charm_passed": "第{day}夜，{actor}号明确空过魅惑，未消费替死，下一夜可选。",
  "event.awakened_beauty_replacement_paid":
    "第{day}天，{actor}号消费唯一替死，原目标{target}号；原伤害{causes}，执行阶段{phase}、根阶段{root}。实际死亡另行结算。",
  "event.awakened_beauty_replaced": "第{day}天，{actor}号发动替死并保持存活，{target}号实际出局。",
  "event.awakened_beauty_replacement_blocked":
    "第{day}天，{actor}号已消费替死并保持存活，目标{target}号的致死被保护阻挡。",
  "replay.stage.awakened_charm_chosen": "秘密魅惑（仅本人）",
  "replay.stage.awakened_beauty_replacement_paid": "替死付款（仅上帝）",
  "replay.stage.awakened_beauty_replaced": "公开替死结果",
  "death.awakened_beauty_replacement": "觉醒狼美人替死",
} as const;
export const en = {
  "role.awakened_wolf_beauty.brief":
    "The Awakened Wolf Beauty joins pack chat and knife votes but cannot self-destruct or vote to kill herself. After knife voting she may charm another living player. A nonempty choice skips the next night; its relation expires at the next actual night. One replacement per game can save her original life only while its original target lives and the cause permits it. A night-origin Awakened Hunter patrol suppresses this replacement; a day-origin patrol permits it. Packmates and targets do not receive her private choices.",
  "role.awakened_wolf_beauty.state":
    "Replacement resource: {resource}. Your choice history: {choices}.",
  "awakened_beauty.resource.ready": "unused",
  "awakened_beauty.resource.spent": "spent, never replenished",
  "awakened_beauty.choice":
    "Night {day}: selected Player {target}; the relation lasts only that night and following day",
  "awakened_beauty.pass": "Night {day}: explicitly passed",
  "action.awakened_charm.hint":
    "Choose another player from the supplied candidates, or null to explicitly pass. Passing spends no replacement and creates no cooldown; you cannot choose yourself.",
  "action.awakened_charm.directive":
    "Use awakened_charm for this private choice. Missing, late or revoked responses are not an explicit null pass.",
  "stage.awakened_charm": "Awakened charm",
  "request.summary.awakened_charm": "Choose this night’s charm target or explicitly pass",
  "prompt.config.awakened_wolf_beauty":
    "This board uses the AWA single replacement policy. A nonempty charm skips the next night and expires at the next actual night. The Beauty cannot self-destruct or self-kill; an independently dying target cannot substitute for her. Night-origin patrol suppresses this replacement. A saved Beauty gets no death words or badge transfer; actual target death resolves separately.",
  "prompt.stage.awakened_charm_candidates":
    "Private charm candidates: {ids}. Candidates are neither role information nor submission authority.",
  "event.awakened_charm_chosen":
    "Night {day}: Player {actor} privately charmed Player {target}; next eligible night is {next}. The replacement has not been spent.",
  "event.awakened_charm_passed":
    "Night {day}: Player {actor} explicitly passed the charm; no replacement was spent and the next night remains eligible.",
  "event.awakened_beauty_replacement_paid":
    "Day {day}: Player {actor} spent the single replacement, originally targeting Player {target}; prevented causes: {causes}, execution phase: {phase}, root phase: {root}. Actual death resolves separately.",
  "event.awakened_beauty_replaced":
    "Day {day}: Player {actor} used a replacement and survived; Player {target} actually died.",
  "event.awakened_beauty_replacement_blocked":
    "Day {day}: Player {actor} spent the replacement and survived; protection blocked the lethal proposal for Player {target}.",
  "replay.stage.awakened_charm_chosen": "Private charm (owner only)",
  "replay.stage.awakened_beauty_replacement_paid": "Replacement payment (God only)",
  "replay.stage.awakened_beauty_replaced": "Public replacement result",
  "death.awakened_beauty_replacement": "Awakened Wolf Beauty replacement",
};
export const messages = { definition, zhCN, en };
