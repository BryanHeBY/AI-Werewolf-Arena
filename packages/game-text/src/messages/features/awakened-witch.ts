/**
 * 负责觉醒女巫与秘密协助的中文/英文模板。输入是稳定键和惰性参数，输出自然语言，不泄露女巫未知的协作结果。
 * 库存/资格由机制拥有；原话作为参数原样嵌入，不翻译昵称、机器值或替玩家生成事实。
 */
import type { MessageDefinition } from "../definition";
export const definition = {
  owner: "features/awakened-witch",
  parameters: {
    "role.awakened_witch.brief": [],
    "role.awakened_witch.state": ["assistants", "brews", "heal", "history"],
    "action.awakened_brew.hint": [],
    "action.awakened_brew.directive": [],
    "action.brew_discuss.hint": [],
    "action.brew_discuss.directive": [],
    "action.brew_approve.hint": [],
    "action.brew_approve.directive": [],
    "stage.awakened_witch": [],
    "stage.brew_discussion": [],
    "stage.brew_approval": [],
    "request.summary.awakened_witch": [],
    "request.summary.brew_discussion": [],
    "request.summary.brew_approval": [],
    "prompt.config.awakened_witch": [],
    "prompt.stage.awakened_brew": [
      "assistants",
      "brews",
      "canHeal",
      "canPoison",
      "heal",
      "knife",
      "required",
      "targets",
    ],
    "prompt.stage.brew_group": ["assistants", "ordinal", "target"],
    "awakened_witch.choice.pass": ["day"],
    "awakened_witch.choice.heal": ["day", "target"],
    "awakened_witch.choice.poison": ["assistants", "day", "ordinal", "target"],
    "bot.brew.discuss": [],
    "event.awakened_brew_pass": ["actor", "day"],
    "event.awakened_brew_heal": ["actor", "day", "target"],
    "event.awakened_brew_poison": ["actor", "assistants", "day", "ordinal", "target"],
    "event.brew_started": ["assistants", "day", "ordinal", "target"],
    "event.brew_discussion": ["actor", "content", "day", "ordinal"],
    "event.brew_approved": ["actor", "day", "ordinal"],
    "event.brew_vetoed": ["actor", "day", "ordinal"],
    "event.brew_resolved_poison": ["day", "ordinal", "target"],
    "event.brew_resolved_vetoed": ["day", "ordinal"],
    "replay.stage.awakened_brew_chosen": [],
    "replay.stage.brew_started": [],
    "replay.stage.brew_discussion": [],
    "replay.stage.brew_approval": [],
    "replay.stage.brew_resolved": [],
  },
} as const satisfies MessageDefinition;
export const zhCN = {
  "role.awakened_witch.brief":
    "觉醒女巫属于好人神职，有一瓶不可自救的解药和三次调毒机会。解药只救当晚基础狼刀；调毒依次需要1、2、3名新协助者，每人整局仅参与一次，不能选自己协助。发起即消耗次数与协助资格，否决也不返还。协助者秘密交流后一人一票，全部同意才产生毒；你不知道他们的发言、决定或结果，不能把调毒当作查验。",
  "role.awakened_witch.state":
    "解药剩余{heal}瓶，调毒剩余{brews}次；已参与协助的座位：{assistants}。本人已付选择：{history}。不包含协作结果。",
  "action.awakened_brew.hint":
    "mode为heal、poison或pass。heal只能当前告知的基础刀口且assistant_ids=[]；poison必须选足本轮所需的新协助者，target_id可为自己；pass必须target_id=null且assistant_ids=[]。",
  "action.awakened_brew.directive":
    "只用awakened_brew决定本夜救人、发起调毒或明确空过。同夜不可兼用；发起即扣资源，失败不自动视为否决。",
  "action.brew_discuss.hint": "text可以为空字符串；只向本轮协助组交流，不会公开或交给女巫。",
  "action.brew_discuss.directive":
    "只用brew_discuss提交本轮一次秘密交流，不把毒目标、成员或本人的角色当作公开信息。",
  "action.brew_approve.hint":
    "approve必须为true或false，仅本人收到选择收据；不能用缺失行动代替否决。",
  "action.brew_approve.directive":
    "只用brew_approve独立决定是否同意这次调毒；看不到他人的票，不得宣称结果已确定。",
  "stage.awakened_witch": "觉醒女巫选择",
  "stage.brew_discussion": "秘密调毒交流",
  "stage.brew_approval": "秘密调毒决定",
  "request.summary.awakened_witch": "选择解药、调毒或明确空过",
  "request.summary.brew_discussion": "向本次协助者秘密交流一次",
  "request.summary.brew_approval": "独立提交本次调毒决定",
  "prompt.config.awakened_witch":
    "本板采用AWA觉醒女巫三次调毒政策，解药不可自救且持有时才知基础刀口。调毒按1/2/3名新协助者消耗，不公开女巫座位。秘密交流与独立批准仅组内可知，女巫不知道结果；只有全同意才产生普通毒，普通守卫与解药均不挡毒。",
  "prompt.stage.awakened_brew":
    "本轮解药{heal}瓶，调毒{brews}次；若调毒需{required}名全新协助者。可选毒目标：{targets}；可选协助：{assistants}；基础刀口：{knife}。本轮可救：{canHeal}；可调毒：{canPoison}。这些名单不是行动许可，引擎会复验原体。",
  "prompt.stage.brew_group":
    "第{ordinal}次调毒，目标{target}号，本次协助组：{assistants}。你不知道女巫座位；只向本组交流，随后秘密独立决定，不获全票或命中结果。",
  "awakened_witch.choice.pass": "第{day}夜明确空过",
  "awakened_witch.choice.heal": "第{day}夜救{target}号",
  "awakened_witch.choice.poison":
    "第{day}夜发起第{ordinal}次调毒，目标{target}号，协助{assistants}",
  "bot.brew.discuss": "先按本局可见信息独立判断；本次目标与协助组是私密信息。",
  "event.awakened_brew_pass": "第{day}夜，{actor}号明确空过，没有消费资源。",
  "event.awakened_brew_heal": "第{day}夜，{actor}号使用唯一解药救{target}号；实际生死另行结算。",
  "event.awakened_brew_poison":
    "第{day}夜，{actor}号发起第{ordinal}次调毒，目标{target}号，协助者{assistants}；已消费次数与协助资格，不向本人反馈结果。",
  "event.brew_started":
    "第{day}夜，第{ordinal}次调毒秘密组已建立：目标{target}号，协助者{assistants}；未公开女巫座位。",
  "event.brew_discussion": "第{day}夜，第{ordinal}次调毒，{actor}号秘密交流：{content}",
  "event.brew_approved": "第{day}夜，第{ordinal}次调毒，{actor}号秘密选择同意。",
  "event.brew_vetoed": "第{day}夜，第{ordinal}次调毒，{actor}号秘密选择反对。",
  "event.brew_resolved_poison":
    "第{day}夜，第{ordinal}次调毒全体同意，对{target}号产生毒提案；实际死亡另行结算。",
  "event.brew_resolved_vetoed":
    "第{day}夜，第{ordinal}次调毒未获全体同意，没有毒提案；资源不返还。",
  "replay.stage.awakened_brew_chosen": "觉醒女巫选择（本人私有）",
  "replay.stage.brew_started": "调毒组（协助者私有）",
  "replay.stage.brew_discussion": "调毒交流（协助者私有）",
  "replay.stage.brew_approval": "调毒决定（本人私有）",
  "replay.stage.brew_resolved": "调毒结算（上帝私有）",
};
export const en = {
  "role.awakened_witch.brief":
    "The Awakened Witch is a good power role with one antidote, no self-heal, and three brewing attempts. The antidote only saves the basic wolf-attack target. Brewing requires 1, then 2, then 3 new assistants; each player assists once per game, and you cannot assist yourself. Starting consumes the attempt and participation even if vetoed. Assistants discuss privately and vote independently; only unanimous approval creates poison. You never learn their discussion, votes or outcome; brewing is not an inspection.",
  "role.awakened_witch.state":
    "Antidotes remaining: {heal}; brewing attempts remaining: {brews}. Previously used assistants: {assistants}. Your committed choices: {history}. Collaboration results are unavailable.",
  "action.awakened_brew.hint":
    "mode is heal, poison or pass. heal requires the supplied basic wolf-attack target and assistant_ids=[]. poison requires exactly the supplied number of new assistants; target_id may be yourself. pass requires target_id=null and assistant_ids=[].",
  "action.awakened_brew.directive":
    "Use only awakened_brew to heal, start brewing or explicitly pass. Healing and brewing are mutually exclusive this night. Starting spends resources; failure is not an automatic veto.",
  "action.brew_discuss.hint":
    "text may be empty. This discussion reaches only this brewing group, never the public or the Witch.",
  "action.brew_discuss.directive":
    "Use only brew_discuss for your one private discussion turn. The target, group members and your role are not public knowledge.",
  "action.brew_approve.hint":
    "approve must be true or false. Only you receive your decision receipt; missing an action is not a veto.",
  "action.brew_approve.directive":
    "Use only brew_approve to decide independently whether to approve this brew. Other votes are hidden; do not claim a confirmed outcome.",
  "stage.awakened_witch": "Awakened Witch choice",
  "stage.brew_discussion": "Private brewing discussion",
  "stage.brew_approval": "Private brewing decision",
  "request.summary.awakened_witch": "Choose an antidote, brewing or an explicit pass",
  "request.summary.brew_discussion": "Discuss once with this brewing group",
  "request.summary.brew_approval": "Submit your independent brewing decision",
  "prompt.config.awakened_witch":
    "This board uses the AWA three-brew policy. The antidote cannot self-heal; the basic wolf target is known only while it remains. Brewing consumes 1/2/3 new assistants and never reveals the Witch seat. Discussion and independent votes are private; the Witch never learns the outcome. Unanimity creates ordinary poison, which ordinary guard and antidote do not block.",
  "prompt.stage.awakened_brew":
    "You have {heal} antidotes and {brews} brewing attempts. Brewing requires {required} new assistants. Poison targets: {targets}; assistant candidates: {assistants}; basic wolf target: {knife}. Healing available: {canHeal}; brewing available: {canPoison}. These lists do not authorize an action; the engine rechecks original lives.",
  "prompt.stage.brew_group":
    "Brew {ordinal} targets Player {target}; this assistant group is {assistants}. You do not know the Witch seat. Discuss only with this group, then decide privately and independently. No vote total or hit result is provided.",
  "awakened_witch.choice.pass": "Night {day}: explicitly passed",
  "awakened_witch.choice.heal": "Night {day}: healed Player {target}",
  "awakened_witch.choice.poison":
    "Night {day}: started brew {ordinal} targeting Player {target}, assisted by {assistants}",
  "bot.brew.discuss":
    "I will judge from visible game information; this target and group are private.",
  "event.awakened_brew_pass":
    "Night {day}: Player {actor} explicitly passed without spending resources.",
  "event.awakened_brew_heal":
    "Night {day}: Player {actor} spent the antidote on Player {target}; actual survival resolves separately.",
  "event.awakened_brew_poison":
    "Night {day}: Player {actor} started brew {ordinal} targeting Player {target}, with assistants {assistants}. The attempt and participation are spent; the Witch receives no outcome.",
  "event.brew_started":
    "Night {day}: private brew {ordinal} started, targeting Player {target}, with assistants {assistants}. The Witch seat is hidden.",
  "event.brew_discussion": "Night {day}, brew {ordinal}: Player {actor} privately says: {content}",
  "event.brew_approved": "Night {day}, brew {ordinal}: Player {actor} privately approved.",
  "event.brew_vetoed": "Night {day}, brew {ordinal}: Player {actor} privately vetoed.",
  "event.brew_resolved_poison":
    "Night {day}: brew {ordinal} was unanimous and created a poison proposal for Player {target}; actual death resolves separately.",
  "event.brew_resolved_vetoed":
    "Night {day}: brew {ordinal} lacked unanimity and created no poison proposal. Resources are not refunded.",
  "replay.stage.awakened_brew_chosen": "Awakened Witch choice (owner only)",
  "replay.stage.brew_started": "Brewing group (assistants only)",
  "replay.stage.brew_discussion": "Brewing discussion (assistants only)",
  "replay.stage.brew_approval": "Brewing decision (owner only)",
  "replay.stage.brew_resolved": "Brewing resolution (God only)",
};
export const messages = { definition, zhCN, en };
