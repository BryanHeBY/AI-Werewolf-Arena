/**
 * Owns the animal dream translations and their neutral key/placeholder definitions.
 * Inputs are existing contract MessageKeys and literal bilingual templates;
 * outputs are matching Chinese/English fragments and named parameter arrays.
 * Empty arrays explicitly mean no interpolation parameters. These definitions
 * never parse facts, execute rules, or validate user-supplied parameters; the
 * shared formatter retains that runtime boundary and preserves raw user text.
 */
import type { MessageDefinition } from "../definition";

export const definition = {
  owner: "features/animal-dream",
  parameters: {
    "replay.stage.animal_night_opened": [],
    "replay.stage.animal_fox_chosen": [],
    "replay.stage.animal_fox_effect": [],
    "replay.stage.animal_knife_notified": [],
    "replay.stage.animal_beauty_notified": [],
    "replay.stage.animal_cat_revealed": [],
    "replay.stage.animal_puffer_revealed": [],
    "replay.stage.animal_puffer_decided": [],
    "replay.stage.animal_puffer_targets": [],
    "replay.stage.animal_wave_prepared": [],
    "replay.stage.animal_wave_committed": [],
    "replay.stage.animal_cat_expiry_prepared": [],
    "replay.stage.animal_unit_completed": [],
    "event.animal_night_opened": ["day"],
    "event.animal_fox_chosen": ["actor", "day", "state"],
    "event.animal_fox_effect": ["day", "state"],
    "event.animal_knife_notified": ["actor", "day", "state"],
    "event.animal_beauty_notified": ["actor", "day", "state"],
    "event.animal_cat_revealed": ["actor"],
    "event.animal_puffer_revealed": ["actor"],
    "event.animal_puffer_decided": ["actor", "day", "state"],
    "event.animal_puffer_targets": ["day", "state"],
    "event.animal_wave_prepared": ["day", "state"],
    "event.animal_wave_committed": ["day", "state"],
    "event.animal_cat_expiry_prepared": ["actor", "day", "state"],
    "event.animal_unit_completed": ["day", "state"],
    "error.animal_action_unavailable": [],
    "role.white_cat.brief": [],
    "role.fox_cub.brief": [],
    "role.pufferfish.brief": [],
    "action.fox_distract.hint": [],
    "action.fox_distract.directive": [],
    "action.puffer_retaliate.hint": [],
    "action.puffer_retaliate.directive": [],
    "stage.fox_distract": [],
    "stage.puffer_reaction": [],
    "prompt.stage.fox_candidates": ["ids"],
    "role.bear.dawn_brief": [],
    "animal.policy.cat_wait": [],
    "animal.policy.cat_skip": [],
    "animal.policy.puffer_first": [],
    "animal.policy.puffer_final": [],
    "rules.animal_dream": ["ballotPolicy", "catPolicy"],
    "role.bear.brief": [],
    "role.bear.state": [],
    "role.bear.latest": ["day", "result"],
    "role.bear.no_report": [],
    "bear.roar": [],
    "bear.quiet": [],
    "console.bear.report": ["day", "result"],
    "replay.stage.bear_roared": [],
  },
} as const satisfies MessageDefinition;

export const zhCN = {
  "replay.stage.animal_night_opened": "实际开夜",
  "replay.stage.animal_fox_chosen": "子狐选择",
  "replay.stage.animal_fox_effect": "子狐实际效果",
  "replay.stage.animal_knife_notified": "本人刀权通知",
  "replay.stage.animal_beauty_notified": "本人狼美人知情",
  "replay.stage.animal_cat_revealed": "白猫活人翻牌",
  "replay.stage.animal_puffer_revealed": "河豚身份公布",
  "replay.stage.animal_puffer_decided": "河豚反击决定",
  "replay.stage.animal_puffer_targets": "河豚原选民全集",
  "replay.stage.animal_wave_prepared": "致死提案",
  "replay.stage.animal_wave_committed": "实际死亡波",
  "replay.stage.animal_cat_expiry_prepared": "白猫到期提案",
  "replay.stage.animal_unit_completed": "实际放逐单位完成",
  "event.animal_night_opened": "第{day}夜动物梦境实际开夜。",
  "event.animal_fox_chosen": "{actor}号第{day}夜子狐选择：{state}。",
  "event.animal_fox_effect": "第{day}夜子狐实际效果：{state}。",
  "event.animal_knife_notified": "{actor}号第{day}夜已授权刀权通知：{state}。",
  "event.animal_beauty_notified": "{actor}号第{day}轮已知狼美人状态：{state}。",
  "event.animal_cat_revealed": "{actor}号公开白猫身份，首次延期后仍存活。",
  "event.animal_puffer_revealed": "{actor}号公开河豚身份。",
  "event.animal_puffer_decided": "{actor}号第{day}轮河豚反击决定：{state}。",
  "event.animal_puffer_targets": "第{day}轮河豚实际反击目标全集：{state}。",
  "event.animal_wave_prepared": "第{day}轮动物梦境致死提案：{state}。",
  "event.animal_wave_committed": "第{day}轮动物梦境实际死亡波：{state}。",
  "event.animal_cat_expiry_prepared": "{actor}号白猫第{day}轮到期提案：{state}。",
  "event.animal_unit_completed": "第{day}轮动物梦境实际放逐单位完成：{state}。",
  "error.animal_action_unavailable":
    "本次动物角色行动不可用、已失效或参数不合法；请只在原行动提示有效时提交允许的参数。",
  "role.white_cat.brief":
    "白猫是好人神职。首次致死会亮牌延寿，仍可投票和持有警徽；延迟至规定的下一放逐单位后真正死亡，反复受击不刷新期限。",
  "role.fox_cub.brief":
    "子狐是好人神职。次夜起整局一次迷惑任意原活人，可自选；null明确空过不耗次数。命中狼阵营取消整队当夜普通刀，命中狼美人另清魅惑。本人的反馈不透露命中或阵营。",
  "role.pufferfish.brief":
    "河豚是好人神职。最终放逐票后整局一次反击由引擎确定的全部原投票人；只决定activate，false不耗次数。真实刀死时另封锁当日狼美人牵连，主动库存和被动独立。",
  "action.fox_distract.hint":
    'fox_distract args: {"target_id":number|null}。候选含自己；null为明确空过。',
  "action.fox_distract.directive":
    "选择一个原活人进行迷惑，或明确提交target_id=null空过；必须作出决定，反馈不公开是否命中。",
  "action.puffer_retaliate.hint":
    'puffer_retaliate args: {"activate":boolean}。只提交是否发动，目标全集由引擎确定，不可挑选子集。',
  "action.puffer_retaliate.directive":
    "决定是否发动对本轮规定原投票人的反击；必须提交activate=true或false，false保留次数。",
  "stage.fox_distract": "子狐迷惑",
  "stage.puffer_reaction": "河豚票后反击",
  "prompt.stage.fox_candidates": "本次可选原活人（含自己）：{ids}；null明确空过。",
  "role.bear.dawn_brief":
    "熊在真实天亮完整死亡链后，按当时仍存活的座位邻居取样并匿名公告；延期仍活的白猫保留邻位。",
  "animal.policy.cat_wait": "自爆跳票不计单位，等待下一次实际放逐结束",
  "animal.policy.cat_skip": "自爆跳过白天结束也计到期单位",
  "animal.policy.puffer_first": "始终反击首轮投给河豚的完整原选民，包括发生PK时",
  "animal.policy.puffer_final": "反击最后完成票轮的完整原选民，PK全弃时不退回首轮",
  "rules.animal_dream":
    "动物梦境原生十二人：整条死亡链结束才判胜，同时屠边采用狼优先；白猫跳票策略={catPolicy}，河豚票轮策略={ballotPolicy}，熊显式天亮取样。",
  "role.bear.brief":
    "入夜按座位环跳过已出局玩家取左右邻居，有可感知狼人则次日咆哮；夜间不重算，熊出局则不咆哮。公告不揭熊或邻居编号。",
  "role.bear.state":
    "你的底牌是【熊】，好人神职，无原生主动技能。每夜开始按当前座位环取左右最近存活邻居；有可感知狼人则次日咆哮，当夜邻居死亡不重算，完整夜死链后你已死亡则不咆哮。全场仅收到是否咆哮，不公布熊ID或邻居。熊感知与预言家查验伪装独立；从未接刀的隐狼不触发（仅在该角色已启用板子有效）。",
  "role.bear.latest": "最近公开公告：第{day}天，{result}。",
  "role.bear.no_report": "尚无已公布的熊公告；本夜待公布信息不可提前获知。",
  "bear.roar": "熊咆哮了",
  "bear.quiet": "熊没有咆哮",
  "console.bear.report": "第{day}天：{result}",
  "replay.stage.bear_roared": "熊公告",
} as const satisfies Record<keyof typeof definition.parameters, string>;

export const en = {
  "replay.stage.animal_night_opened": "Actual night opening",
  "replay.stage.animal_fox_chosen": "Fox choice",
  "replay.stage.animal_fox_effect": "Actual Fox effect",
  "replay.stage.animal_knife_notified": "Own knife permission",
  "replay.stage.animal_beauty_notified": "Own Wolf Beauty knowledge",
  "replay.stage.animal_cat_revealed": "Living White Cat reveal",
  "replay.stage.animal_puffer_revealed": "Pufferfish reveal",
  "replay.stage.animal_puffer_decided": "Pufferfish decision",
  "replay.stage.animal_puffer_targets": "Complete Pufferfish voters",
  "replay.stage.animal_wave_prepared": "Lethal proposals",
  "replay.stage.animal_wave_committed": "Actual death wave",
  "replay.stage.animal_cat_expiry_prepared": "White Cat expiry proposal",
  "replay.stage.animal_unit_completed": "Actual exile unit completed",
  "event.animal_night_opened": "Animal Dream actually opened night {day}.",
  "event.animal_fox_chosen": "Player {actor}, night {day} Fox choice: {state}.",
  "event.animal_fox_effect": "Night {day} actual Fox effect: {state}.",
  "event.animal_knife_notified": "Player {actor}, night {day} authorized knife notice: {state}.",
  "event.animal_beauty_notified": "Player {actor}, cycle {day} known Wolf Beauty state: {state}.",
  "event.animal_cat_revealed":
    "Player {actor} reveals White Cat and remains alive after its first deferral.",
  "event.animal_puffer_revealed": "Player {actor} reveals Pufferfish.",
  "event.animal_puffer_decided": "Player {actor}, cycle {day} Pufferfish decision: {state}.",
  "event.animal_puffer_targets":
    "Cycle {day} complete actual Pufferfish retaliation targets: {state}.",
  "event.animal_wave_prepared": "Cycle {day} Animal Dream lethal proposals: {state}.",
  "event.animal_wave_committed": "Cycle {day} Animal Dream actual death wave: {state}.",
  "event.animal_cat_expiry_prepared":
    "Player {actor}, cycle {day} White Cat expiry proposal: {state}.",
  "event.animal_unit_completed": "Cycle {day} Animal Dream actual exile unit completed: {state}.",
  "error.animal_action_unavailable":
    "This animal-role action is unavailable, expired, or has invalid arguments. Submit only the permitted arguments while the original action prompt is valid.",
  "role.white_cat.brief":
    "White Cat is a good special role. Its first lethal proposal reveals it and defers death while it remains alive, able to vote and hold the badge. It expires after the designated next exile unit; further attacks do not reset the clock.",
  "role.fox_cub.brief":
    "Fox Cub is a good special role. From Night 2, it has one whole-game distraction of any original living player, including itself; null is an explicit free pass. A wolf hit disables the whole pack's ordinary knife for that night, and a Wolf Beauty hit also clears charm. Your feedback never identifies a hit or faction.",
  "role.pufferfish.brief":
    "Pufferfish is a good special role. After the final exile ballot it may once retaliate against the complete original voter set selected by the engine. Submit only activate; false preserves the use. An actual knife death independently blocks Wolf Beauty's link that day.",
  "action.fox_distract.hint":
    'fox_distract args: {"target_id":number|null}. Candidates include yourself; null explicitly passes.',
  "action.fox_distract.directive":
    "Choose an original living player to distract, or explicitly submit target_id=null to pass. A decision is required and its feedback does not reveal a hit.",
  "action.puffer_retaliate.hint":
    'puffer_retaliate args: {"activate":boolean}. Decide only whether to activate; the engine owns the complete target set and no subset is allowed.',
  "action.puffer_retaliate.directive":
    "Decide whether to retaliate against the prescribed original voters. Submit activate=true or false; false preserves the use.",
  "stage.fox_distract": "Fox Cub distraction",
  "stage.puffer_reaction": "Pufferfish ballot reaction",
  "prompt.stage.fox_candidates":
    "Original living candidates, including yourself: {ids}; null explicitly passes.",
  "role.bear.dawn_brief":
    "At actual dawn after the complete death chain, Bear samples its currently living seat neighbors and publishes an anonymous signal. A deferred but living White Cat retains its seat.",
  "animal.policy.cat_wait": "Skipped votes do not count; wait for the next actual exile unit",
  "animal.policy.cat_skip": "A self-destruct that ends the day also counts as an expiry unit",
  "animal.policy.puffer_first":
    "Retaliate against the full original first-round voters, including when PK occurs",
  "animal.policy.puffer_final":
    "Use the full final-round voters; an empty PK round never falls back to round one",
  "rules.animal_dream":
    "Native twelve-player Animal Dream: judge only after the full death chain, with wolf priority for simultaneous side elimination. Cat skipped-vote policy={catPolicy}; Puffer ballot policy={ballotPolicy}; Bear explicitly samples at dawn.",
  "role.bear.brief":
    "At night start, sample the nearest living neighbors on both sides of the seat ring; a detectable wolf causes a roar at dawn. Do not resample during the night; a dead Bear stays quiet. The announcement names neither Bear nor neighbors.",
  "role.bear.state":
    "Your role is Bear, a good special role with no native active skill. At each night start sample the nearest living neighbors on both sides of the current seat ring; a detectable wolf causes a roar at dawn. Neighbors dying that night do not change the sample; if you are dead after the complete night death chain, stay quiet. Everyone hears only whether Bear roared, never Bear or neighbor IDs. Bear sensing is separate from Seer inspection disguises; a Hidden Wolf that has never inherited the knife does not trigger it (only on boards where that role is enabled).",
  "role.bear.latest": "Latest public announcement: day {day}, {result}.",
  "role.bear.no_report":
    "No Bear announcement has been published yet; this night's pending result is unavailable.",
  "bear.roar": "Bear roared",
  "bear.quiet": "Bear did not roar",
  "console.bear.report": "Day {day}: {result}",
  "replay.stage.bear_roared": "Bear announcement",
} satisfies Record<keyof typeof definition.parameters, string>;

export const messages = { definition, zhCN, en };
