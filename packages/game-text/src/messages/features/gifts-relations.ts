/**
 * 负责鬼新娘、孤独少女、野孩子、情侣、赠予技能及匿名墙／辩论／首夜选牌的两语文案。
 * 输入为本家族既有 key、占位名单及 literal 模板；输出为关系、库存说明、行动／窗口提示和复盘标签。
 * 本模块不复制能力、关闭关系或消费匿名便笺，文案中的目标／数量来自原调用方事实；
 * 参数接受与用户聊天原文保留归格式化器，关系权限和资源提交仍由原 owner 执行。
 */
import type { MessageDefinition } from "../definition";

// parameters 定义本家族拥有的 key 及排序后的唯一参数名；空数组是明确无插值，不是遗漏声明。
export const definition = {
  owner: "features/gifts-relations",
  parameters: {
    "rules.lovers.netease": [],
    "rules.lovers.lui": [],
    "console.ghost_bride_pair_chosen": ["bride", "groom"],
    "replay.stage.ghost_bride_pair_chosen": [],
    "console.ghost_bride_group_chosen": ["bride", "groom", "witness"],
    "replay.stage.ghost_bride_group_chosen": [],
    "console.ghost_bride_witness_vote": ["actor", "target", "vote"],
    "replay.stage.ghost_bride_witness_vote": [],
    "console.ghost_bride_partner_chat": ["actor", "body", "recipient"],
    "replay.stage.ghost_bride_partner_chat": [],
    "console.ghost_bride_knife_captured": ["actors", "day", "owner"],
    "replay.stage.ghost_bride_knife_captured": [],
    "console.ghost_bride_knife_vote": ["actor", "target"],
    "replay.stage.ghost_bride_knife_vote": [],
    "console.ghost_bride_knife_resolved": ["day", "target"],
    "replay.stage.ghost_bride_knife_resolved": [],
    "console.ghost_bride_partner_death": ["actor", "target"],
    "replay.stage.ghost_bride_partner_death": [],
    "wedding.owner.ordinary_pack": [],
    "wedding.owner.pair": [],
    "wedding.owner.witness": [],
    "wedding.owner.none": [],
    "role.ghost_bride.brief": [],
    "role.ghost_bride.state": ["state"],
    "prompt.status.wedding": ["state"],
    "action.choose_bridegroom.hint": [],
    "action.choose_wedding_witness.hint": [],
    "action.speak_to_partner.hint": [],
    "action.wedding_kill_vote.hint": [],
    "error.ghost_bride_unavailable": [],
    "error.ghost_bride_choice": [],
    "stage.ghost_bride_groom": [],
    "stage.ghost_bride_chat": [],
    "stage.ghost_bride_witness": [],
    "stage.ghost_bride_knife": [],
    "role.lonely_girl.brief": [],
    "role.lonely_girl.state": ["state"],
    "prompt.status.lonely_girl": ["state"],
    "action.choose_admired_player.hint": [],
    "turn.lonely_girl.required": [],
    "stage.lonely_girl": [],
    "error.lonely_girl_unavailable": [],
    "error.lonely_girl_choice": [],
    "console.lonely_girl.choice": ["actor", "target"],
    "console.lonely_girl.god": ["actor", "camp", "target"],
    "replay.stage.lonely_girl_admired_chosen": [],
    "role.wild_child.brief": [],
    "role.wild_child.state": ["camp", "state"],
    "prompt.status.wild_child": ["state"],
    "action.choose_wild_model.hint": [],
    "turn.wild_child.required": [],
    "stage.wild_child": [],
    "error.wild_child_unavailable": [],
    "error.wild_child_choice": [],
    "console.wild_child.choice": ["actor", "target"],
    "console.wild_child.death": ["actor", "causes", "target"],
    "console.wild_child.transform": ["actor", "night"],
    "console.wild_child.active": ["actor", "night"],
    "replay.stage.wild_child_model_chosen": [],
    "replay.stage.wild_child_model_eliminated": [],
    "replay.stage.wild_child_transformed": [],
    "replay.stage.wild_child_pack_activated": [],
    "action.write_note.hint": [],
    "request.summary.wall_notes": [],
    "stage.wall_notes": [],
    "error.wall_note_unavailable": [],
    "error.wall_note_text": [],
    "prompt.status.wall_note": ["state"],
    "item.operation.granted": [],
    "item.operation.accepted": [],
    "item.operation.rejected": [],
    "item.operation.revoked": [],
    "item.operation.expired": [],
    "replay.stage.wall_notes_started": [],
    "replay.stage.wall_notes_published": [],
    "replay.stage.wall_notes_canceled": [],
    "replay.stage.wall_note_changed": [],
    "replay.stage.wall_note_order_recorded": [],
    "role.debater.brief": [],
    "role.debater.state": [],
    "role.debater.status": ["state"],
    "action.challenge.hint": [],
    "action.debate_vote.hint": [],
    "prompt.targets.debate": ["target"],
    "prompt.status.debate_penalty": [],
    "error.debate_unavailable": [],
    "error.debate_target": [],
    "error.debate_ballot": [],
    "console.debate.reveal": ["actor"],
    "console.debate.start": ["actor", "target"],
    "console.debate.speech": ["actor", "speech"],
    "console.debate.cancel": ["actor", "target"],
    "console.debate.ledger": ["actor", "target"],
    "console.debate.result": [
      "abstentions",
      "actor",
      "blocked",
      "eligible",
      "rejects",
      "result",
      "supports",
      "target",
    ],
    "request.summary.debate_challenge": ["target"],
    "request.summary.debate_speech": [],
    "request.summary.debate_ballot": [],
    "stage.debate_challenge": [],
    "stage.debate_speech": [],
    "stage.debate_ballot": [],
    "replay.stage.debater_revealed": [],
    "replay.stage.debate_started": [],
    "replay.stage.debate_speech": [],
    "replay.stage.debate_resolved": [],
    "replay.stage.debate_canceled": [],
    "replay.stage.debate_ballots_recorded": [],
    "rule.netease_2017_cupid_follows_lovers_v1": [],
    "rule.lui_meme_lovers_only_v1": [],
    "prompt.status.lovers_vote": [],
    "role.shapeshifter.brief": [],
    "role.shapeshifter.state": ["state"],
    "action.choose_shapeshifter_card.hint": [],
    "stage.shapeshifter": [],
    "replay.stage.shapeshifter_initial_deal": [],
    "replay.stage.shapeshifter_identity_chosen": [],
    "error.shapeshifter_unavailable": [],
    "error.shapeshifter_choice": [],
    "prompt.board.shapeshifter": [],
    "prompt.status.shapeshifter": ["state"],
    "console.shapeshifter.deal": ["roles", "size"],
    "console.shapeshifter.choice": ["actor", "camp", "role", "slot"],
    "console.shapeshifter": [],
    "turn.shapeshifter.required": [],
    "role.thief.brief": [],
    "role.thief.state": ["state"],
    "action.choose_thief_card.hint": [],
    "stage.thief": [],
    "replay.stage.thief_initial_deal": [],
    "replay.stage.thief_identity_chosen": [],
    "error.thief_unavailable": [],
    "error.thief_choice": [],
    "prompt.board.thief": [],
    "prompt.status.thief": ["state"],
    "console.thief.deal": ["roles", "size"],
    "console.thief.choice": ["actor", "camp", "role", "slot"],
    "console.thief.keep": ["actor"],
    "console.thief": [],
    "turn.thief.required": [],
    "turn.thief.optional": [],
    "role.cupid.brief": [],
    "role.cupid.state": [],
    "role.cupid.netease": [],
    "role.cupid.lui": [],
    "role.cupid.status": ["state"],
    "action.choose_lovers.hint": [],
    "prompt.targets.lovers": ["ids"],
    "stage.cupid": [],
    "error.cupid_unavailable": [],
    "error.cupid_target": [],
    "error.lovers_vote": [],
    "console.cupid.choice": ["actor", "first", "second"],
    "console.cupid.recognition": ["actor", "partner"],
    "console.cupid.resolved": [
      "actor",
      "first",
      "firstCamp",
      "mixed",
      "policy",
      "second",
      "secondCamp",
    ],
    "console.cupid.death": ["actor", "target"],
    "replay.stage.cupid_lovers_chosen": [],
    "replay.stage.cupid_relation_resolved": [],
    "replay.stage.lovers_death": [],
    "reason.cupid_lovers_only_survivors": [],
    "victory.group.cupid_lovers": [],
    "stage.black_market_merchant": [],
    "stage.black_market_recipient": [],
    "ability.black_market.rules": [],
    "role.black_market_merchant.brief": [],
    "role.black_market_merchant.state": [],
    "role.black_market_merchant.status": ["state"],
    "action.black_market_trade.hint": [],
    "action.black_market_recipient.directive": [],
    "replay.stage.black_market_merchant": [],
    "replay.stage.black_market_recipient": [],
    "replay.stage.black_market_trade_committed": [],
    "replay.stage.black_market_trade_skipped": [],
    "replay.stage.black_market_trade_resolved": [],
    "black_market.skill.gun": [],
    "black_market.skill.check": [],
    "black_market.skill.poison": [],
    "console.black_market.choice": ["actor", "day", "skill", "target"],
    "console.black_market.skip": ["actor", "day"],
    "console.black_market.result": ["actor", "day", "outcome", "skill", "target"],
    "error.black_market_skill": [],
    "death.black_market_backlash": [],
    "prompt.targets.lucky_poison": ["actor", "ids"],
    "action.lucky.directive": [],
    "role.miracle_merchant.brief": [],
    "role.miracle_merchant.state": [],
    "role.miracle_merchant.status": ["state"],
    "action.bestow_ability.hint": [],
    "stage.miracle_merchant": [],
    "error.merchant_unavailable": [],
    "error.merchant_target": [],
    "error.merchant_skill": [],
    "merchant.skill.check": [],
    "merchant.skill.poison": [],
    "merchant.skill.guard": [],
    "merchant.outcome.granted": [],
    "merchant.outcome.backlash": [],
    "console.merchant.trade": ["actor", "day", "skill", "target"],
    "console.merchant.skip": ["actor", "day"],
    "console.merchant.outcome": ["actor", "day", "outcome", "skill", "target"],
    "ability.lucky.rules": [],
    "ability.lucky.history": ["actions"],
    "console.lucky.skipped": ["ability", "actor", "day"],
    "stage.lucky": [],
    "error.lucky_target_repeat": [],
    "replay.stage.lucky_ability_skipped": [],
    "replay.stage.merchant_trade_committed": [],
    "replay.stage.merchant_trade_resolved": [],
    "replay.stage.merchant_trade_skipped": [],
    "replay.stage.lucky": [],
    "replay.stage.gift_ability": [],
    "replay.gift_ability_skipped": ["ability", "actor", "day"],
  },
} as const satisfies MessageDefinition;

export const zhCN = {
  "console.ghost_bride_pair_chosen": "鬼魂新娘{bride}号与{groom}号成为情侣。",
  "replay.stage.ghost_bride_pair_chosen": "\u5a5a\u793c\u4e8b\u5b9e",
  "console.ghost_bride_group_chosen": "婚礼三方：新娘{bride}号、新郎{groom}号、证婚人{witness}号。",
  "replay.stage.ghost_bride_group_chosen": "\u5a5a\u793c\u4e8b\u5b9e",
  "console.ghost_bride_witness_vote": "God：{actor}号第{vote}次提名证婚人{target}号。",
  "replay.stage.ghost_bride_witness_vote": "\u5a5a\u793c\u4e8b\u5b9e",
  "console.ghost_bride_partner_chat": "情侣私聊：{actor}号向{recipient}号发送：{body}",
  "replay.stage.ghost_bride_partner_chat": "\u5a5a\u793c\u4e8b\u5b9e",
  "console.ghost_bride_knife_captured": "God：第{day}夜婚礼板刀权为{owner}，参与者{actors}。",
  "replay.stage.ghost_bride_knife_captured": "\u5a5a\u793c\u4e8b\u5b9e",
  "console.ghost_bride_knife_vote": "婚礼刀票：{actor}号选择{target}。",
  "replay.stage.ghost_bride_knife_vote": "\u5a5a\u793c\u4e8b\u5b9e",
  "console.ghost_bride_knife_resolved": "第{day}夜婚礼刀票结论：{target}。",
  "replay.stage.ghost_bride_knife_resolved": "\u5a5a\u793c\u4e8b\u5b9e",
  "console.ghost_bride_partner_death": "God：{actor}号死亡牵连情侣{target}号。",
  "replay.stage.ghost_bride_partner_death": "\u5a5a\u793c\u4e8b\u5b9e",
  "wedding.owner.ordinary_pack": "单身狼群",
  "wedding.owner.pair": "情侣",
  "wedding.owner.witness": "证婚人",
  "wedding.owner.none": "无刀权",
  "role.ghost_bride.brief":
    "墨尔本赛事AWA三方适配：首夜选择新郎，共同确认证婚人。保留原身份库存，婚礼三人独立胜利；情侣互认与私聊，一人死亡另一人殉情。普通单身狼清空后情侣继承刀，情侣均死后证婚人继承。",
  "role.ghost_bride.state":
    "鬼魂新娘本人首夜机会：{state}。新郎与证婚人保留原身份和原生库存，不向你披露。",
  "prompt.status.wedding":
    "本人的婚礼关系和独立第三方目标：{state}。胜利需清除其余两个阵营；情侣殉情不能开枪。此处只含授权编号和本人刀权，不提供伙伴或证婚人的底牌、库存。",
  "action.choose_bridegroom.hint": "首夜必须选择另一名活人作为新郎；不能弃选、重选或默认代选。",
  "action.choose_wedding_witness.hint":
    "证婚人必须是情侣以外活人。新娘先提名，新郎必须提交同一编号确认；不一致会使首夜设置失败，不能回退代选。",
  "action.speak_to_partner.hint":
    "对原伴侣发送本次唯一私聊；必须提交text，空字符串是明确跳过。证婚人不接收聊天。",
  "action.wedding_kill_vote.hint":
    "继承刀权者必须提交规范刀票：选择整数target_id且abstain=false，或target_id=null且abstain=true；情侣不能选双方，证婚人不能选自己。",
  "error.ghost_bride_unavailable": "当前婚礼原生命、请求预算或共同授权已失效。",
  "error.ghost_bride_choice": "必须提交本回合授权的规范婚礼选择，不可默认代选。",
  "stage.ghost_bride_groom": "鬼魂新娘选择新郎",
  "stage.ghost_bride_chat": "情侣私聊",
  "stage.ghost_bride_witness": "共同选择证婚人",
  "stage.ghost_bride_knife": "婚礼继承夜刀",
  "role.lonely_girl.brief":
    "首夜先选择另一活人为崇拜对象，个人胜利跟随其选择时真实阵营；自身仍是好人民边，无狼互认、夜聊、刀或自爆。你不知道对象身份，对象不知道被崇拜。AWA策略固定胜利归属，死亡不撤销。",
  "role.lonely_girl.state": "孤独少女私有选择状态：{state}；目标身份和冻结归属不会直接告知本人。",
  "prompt.status.lonely_girl":
    "孤独少女当前选择状态：{state}。你始终是好人民边；封盘前不直接获知对象阵营，终局胜负可能允许推断。",
  "action.choose_admired_player.hint": "首夜必须选择另一名活人作为崇拜对象；不能自选、弃选或重选。",
  "turn.lonely_girl.required": "必须选择合法崇拜对象；不能跳过或默认代选。",
  "stage.lonely_girl": "孤独少女首夜崇拜",
  "error.lonely_girl_unavailable": "当前没有原生命与首夜授权的孤独少女选择窗口。",
  "error.lonely_girl_choice": "崇拜对象必须是另一名当前授权的活人。",
  "console.lonely_girl.choice": "孤独少女{actor}号选择崇拜{target}号。",
  "console.lonely_girl.god": "孤独少女{actor}号选择崇拜{target}号，个人胜利归属为{camp}。",
  "replay.stage.lonely_girl_admired_chosen": "孤独少女私有选择",
  "role.wild_child.brief":
    "初始为好人民边，首夜必选榜样；榜样实际淘汰时若本人仍活则变狼，下一夜才互认、夜聊与投刀。不获榜样能力，不可自爆。",
  "role.wild_child.state":
    "初始好人介绍为历史。当前真实阵营：{camp}；你的榜样与阶段：{state}。chosen仍好人，transformed已是真狼但尚无狼队权限，active才有双向互认/夜聊/刀权。",
  "prompt.status.wild_child":
    "野孩子本人状态：{state}；不透露榜样角色/阵营或隐藏死因，不能重选或复活刷新。",
  "action.choose_wild_model.hint":
    "首夜必须选一个其它活人作为榜样，一局一次；只提交target_id，不获其角色/阵营。",
  "turn.wild_child.required": "必须选择合法榜样；不能跳过或默认代选。",
  "stage.wild_child": "野孩子首夜选榜样",
  "error.wild_child_unavailable": "当前没有原生命与首夜授权的野孩子选择窗口。",
  "error.wild_child_choice": "榜样必须是另一名当前授权的活人。",
  "console.wild_child.choice": "野孩子{actor}号选择{target}号为榜样。",
  "console.wild_child.death": "野孩子{actor}号的榜样{target}号已实际死亡，来源：{causes}。",
  "console.wild_child.transform": "野孩子{actor}号现在属于狼阵营，从第{night}夜才能入群。",
  "console.wild_child.active": "野孩子{actor}号已在第{night}夜加入狼群，启用互认、夜聊与投刀。",
  "replay.stage.wild_child_model_chosen": "野孩子私有事实",
  "replay.stage.wild_child_model_eliminated": "野孩子私有事实",
  "replay.stage.wild_child_transformed": "野孩子私有事实",
  "replay.stage.wild_child_pack_activated": "野孩子私有事实",
  "action.write_note.hint":
    "匿名纸条，可不提交。write_note只写本人自由短句：1–160个Unicode字符，不能全空白；保留原文字。收齐后随机公布，无作者关联。",
  "request.summary.wall_notes": "可写一张匿名纸条，也可不提交；本轮关闭即过期。",
  "stage.wall_notes": "匿名墙纸条",
  "error.wall_note_unavailable": "没有本人可用的匿名纸条窗口。",
  "error.wall_note_text": "纸条须为1–160个Unicode字符，不能全空白或含无效代理字符。",
  "prompt.status.wall_note": "本人的匿名纸条实例与有效库存：{state}。不包含其他作者的投稿。",
  "item.operation.granted": "发放",
  "item.operation.accepted": "接受",
  "item.operation.rejected": "拒绝",
  "item.operation.revoked": "撤权",
  "item.operation.expired": "过期",
  "replay.stage.wall_notes_started": "匿名墙事实",
  "replay.stage.wall_notes_published": "匿名墙事实",
  "replay.stage.wall_notes_canceled": "匿名墙事实",
  "replay.stage.wall_note_changed": "匿名墙事实",
  "replay.stage.wall_note_order_recorded": "匿名墙事实",
  "role.debater.brief":
    "整局一次翻牌开杠当前普通发言者；全体活人匿名表决，严格过半禁对方当日放逐票，否则禁自己。",
  "role.debater.state":
    "你是好人神职杠精。AWA适配墨尔本2026规则：普通放逐发言前可开杠当前指定的其他活人，整局一次。接受后公开翻牌且立即消费；你先发言，对方随后发言，再由冻结的全体活人（含双方和已翻牌白痴）匿名投支持/反对/弃权。严格超过全体人数一半则成功，对方本次普通发言被取消、当天普通与PK放逐禁票；否则你当天放逐禁票。成功且对方持警徽则警徽自动移交给你，保留配置权重；不影响警长选举或PK发言。失效取消不补已消费机会。",
  "role.debater.status": "你的有效机会与已选记录：{state}。",
  "action.challenge.hint": "可用challenge指定当前窗口唯一target_id，或不选择而保留机会。",
  "action.debate_vote.hint": "匿名表决support=true支持杠精、false反对、null弃权；不使用放逐票重。",
  "prompt.targets.debate": "本窗口challenge唯一合法target_id：{target}。不可选择自己或其他编号。",
  "prompt.status.debate_penalty": "你本日普通与PK放逐禁票；匿名开杠表决与警长选举不受影响。",
  "error.debate_unavailable": "当前没有授权的未消费杠精窗口。",
  "error.debate_target": "只能开杠本窗口指定的其他活人。",
  "error.debate_ballot": "匿名开杠表决仅当前授权活人可提交true、false或null。",
  "console.debate.reveal": "{actor}号公开翻牌为杠精，仍然存活。",
  "console.debate.start": "{actor}号开杠{target}号。",
  "console.debate.speech": "开杠发言（{actor}号）：{speech}",
  "console.debate.cancel": "{actor}号对{target}号的开杠因窗口失效取消；已消费机会不返还。",
  "console.debate.ledger": "上帝记录：{actor}号对{target}号的匿名选票已收集。",
  "console.debate.result":
    "{actor}号开杠{target}号：全体{eligible}人，支持{supports}、反对{rejects}、弃权{abstentions}，成功：{result}；{blocked}号本日放逐禁票。",
  "request.summary.debate_challenge": "是否开杠当前指定的{target}号？",
  "request.summary.debate_speech": "提交你的公开开杠发言。",
  "request.summary.debate_ballot": "匿名表决是否支持杠精。",
  "stage.debate_challenge": "杠精开杠选择",
  "stage.debate_speech": "双方开杠发言",
  "stage.debate_ballot": "匿名开杠表决",
  "replay.stage.debater_revealed": "杠精翻牌",
  "replay.stage.debate_started": "开杠",
  "replay.stage.debate_speech": "开杠发言",
  "replay.stage.debate_resolved": "开杠结果",
  "replay.stage.debate_canceled": "开杠取消",
  "replay.stage.debate_ballots_recorded": "上帝匿名选票记录",
  "rule.netease_2017_cupid_follows_lovers_v1": "网易2017：丘比特跟随情侣",
  "rule.lui_meme_lovers_only_v1": "Lui-même原版：独立丘比特随好人",
  "rules.lovers.netease":
    "本局情侣规则（网易2017）：情侣只互认伴侣编号，不获知伴侣底牌、阵营或秘密胜利归属；原身份、技能、查验结果与狼队权限不变。一人死亡，另一人殉情且不能发动死亡技能，保护无法阻止殉情。双好情侣随好人获胜，双狼情侣随狼人获胜；人狼恋须双方存活并消灭除情侣与丘比特外的所有人。丘比特始终跟随情侣胜利，可以已出局。本局不额外禁止情侣互相放逐投票。上述是条件规则，不表示你已知道伴侣阵营。",
  "rules.lovers.lui":
    "本局情侣规则（Lui-même）：情侣只互认伴侣编号，不获知伴侣底牌、阵营或秘密胜利归属；原身份、技能、查验结果与狼队权限不变。一人死亡，另一人殉情且不能发动死亡技能，保护无法阻止殉情。双好情侣随好人获胜，双狼情侣随狼人获胜；人狼恋须双方存活并消灭所有其他人，包括未入情侣的丘比特。未入情侣的丘比特仍随好人；丘比特若入情侣则随情侣。情侣不能互相投放逐票（包括PK），警长投票不受此限制。上述是条件规则，不表示你已知道伴侣阵营。",
  "prompt.status.lovers_vote": "此来源策略禁止情侣互投放逐（包括PK）。",
  "role.shapeshifter.brief": "第一夜在其它技能前必选一张底牌；只要有普通狼牌就必须选狼。",
  "role.shapeshifter.state":
    "开局为千面人/好人民边。第一夜在所有其它技能前查看本人两张底牌并必须选一张；有狼时只能选狼槽，两狼可任选。没有保留千面人选项。换牌同步安装真实身份、阵营、胜利归属与原生库存，首夜即启用；编号、生命、警徽、票权和历史保留。当前私有机会：{state}。",
  "action.choose_shapeshifter_card.hint":
    "choose_shapeshifter_card只接受整数slot0或1；必须属于本人allowedSlots。任何底牌组合都必选，出现狼必须选狼。禁止null、保留、玩家编号、额外字段或回退代选。",
  "stage.shapeshifter": "千面人首次身份必选",
  "replay.stage.shapeshifter_initial_deal": "千面人上帝初始牌池",
  "replay.stage.shapeshifter_identity_chosen": "千面人身份选择",
  "error.shapeshifter_unavailable": "千面人的原身份、物理底牌或首次选择权限已关闭或撤销。",
  "error.shapeshifter_choice":
    "必须提交唯一整数slot0或1且属于本人allowedSlots；有狼只可选狼，禁止保留或额外字段。",
  "prompt.board.shapeshifter":
    "上述为N+2候选牌计数，实际只有N名玩家，另有两张未知底牌；不得据此推断实际场上角色人数，千面人可能落底。",
  "prompt.status.shapeshifter": "本人千面人首次机会与授权底牌（仅本人可见）：{state}。",
  "console.shapeshifter.deal": "千面人上帝开局完整N+2牌序：{roles}；实际玩家{size}名。",
  "console.shapeshifter.choice":
    "千面人本人{actor}号选择底牌槽{slot}，当前真实身份{role}、阵营{camp}。",
  "console.shapeshifter": "千面人身份事实",
  "turn.shapeshifter.required":
    "必须提交一次choose_shapeshifter_card，整数slot须属于本人allowedSlots；只要有狼必须选狼，禁止保留与代选。",
  "role.thief.brief": "首夜查看两张额外底牌，可换一张；两张都是狼人时必须换牌。",
  "role.thief.state":
    "你是开局盗贼，初始为好人民边。仅第一夜身份启用前查看本人两底牌：两张普通狼人必须选slot0或slot1，其它组合可不调用工具保留盗贼或选任一slot。只给本人底牌，不给他人身份或已发牌数量。换牌后真实角色、阵营、胜利及原生库存更新，同夜按新角色行动；原编号/生命/警徽/票权/会话历史保留。整局一次，不复制/赠予技能。当前本人机会：{state}。",
  "action.choose_thief_card.hint":
    "选择工具choose_thief_card的整数slot为0或1，代表本人所见底牌槽，不能填玩家编号/null。两底皆狼必须选择且禁止回退代选，其它组合可无动作保留。",
  "stage.thief": "盗贼首次身份选择",
  "replay.stage.thief_initial_deal": "上帝初始牌池",
  "replay.stage.thief_identity_chosen": "盗贼身份选择",
  "error.thief_unavailable": "盗贼首次身份或底牌授权已关闭/撤销，当前请求不能选择。",
  "error.thief_choice": "请只提交整数slot0或1，不能使用玩家编号、null或额外字段。",
  "prompt.board.thief":
    "本局有盗贼：上述为N+2张候选牌，实际只发给N名玩家，两底牌不上场；实际角色数量未知，不能把候选数量当作在场数量。",
  "prompt.status.thief": "本人盗贼机会与当前授权底牌（只有本人可见）：{state}。",
  "console.thief.deal": "上帝开局完整N+2牌序：{roles}；实际玩家{size}名。",
  "console.thief.choice": "盗贼本人{actor}号选择底牌槽{slot}，当前真实身份{role}、阵营{camp}。",
  "console.thief.keep": "盗贼本人{actor}号保留盗贼身份，首次机会已关闭。",
  "console.thief": "盗贼身份事实",
  "turn.thief.required": "两底牌皆为狼人，必须提交一次choose_thief_card(slot0或1)，禁止代选。",
  "turn.thief.optional":
    "可以提交一次choose_thief_card(slot0或1)换牌，或不调用工具保留盗贼；禁止代选。",
  "role.cupid.brief": "首夜连接两名情侣；一人死亡另一人殉情，殉情禁技能；按具名来源策略判胜。",
  "role.cupid.state":
    "你的底牌是【丘比特】，真实阵营为好人神职。首夜轮到你时，必须以choose_lovers选择两名不同存活玩家，可包括自己。不能选空、重复或已出局目标，也不能跳过后夜补选。提交后不能更换；你只知道所选编号，不知道底牌、阵营或秘密胜利分组。情侣只互认编号，保留原技能、查验结果及原狼队权限。一人死亡使另一人殉情；殉情不能发动枪与狼美人死亡牵连，保护不能阻挡。两人即使在同一轮死亡中分别被杀，仍同时计入殉情、不能发动相应死亡技能。当夜已经生效的摄梦关系仍按夜死条件牵连。整条死亡连锁结束才判胜。",
  "role.cupid.netease":
    "来源策略：网易2017。你始终跟随情侣胜利。双好人情侣随好人；双狼人情侣随狼，但你不会因此获得狼队信息或刀权，也不会被当作额外真狼。人狼恋的两个情侣须同时存活并消灭除情侣和你之外的所有人；你可活或死而同胜。跟随狼或第三方的你不阻挡狼屠城；全体真狼死亡照常好人胜。网易未明确禁情侣互投，当前保留AWA许可。",
  "role.cupid.lui":
    "来源策略：Lui-même原版。你若未被选为情侣，仍随好人并计好人数。人狼恋双方必须存活并消灭所有其他人，包括独立丘比特。你若在情侣中则随情侣。情侣不能互相放逐投票（包括PK）；不限制警长选举。",
  "role.cupid.status": "你自己的已选编号与机会：{state}。上帝没有告诉你情侣的底牌或阵营。",
  "action.choose_lovers.hint": "必须选两名不同活人：first_id和second_id；可选自己，不可跳过。",
  "prompt.targets.lovers":
    "first_id和second_id分别选自实际活人编号：{ids}；二者必须不同，可包括自己。",
  "stage.cupid": "丘比特连接情侣",
  "error.cupid_unavailable": "丘比特连接仅首夜本人获授权且未提交时可用。",
  "error.cupid_target": "请选择两名不同的实际活人整数编号，可包括自己。",
  "error.lovers_vote": "当前原版策略禁止情侣互相放逐投票。",
  "console.cupid.choice":
    "丘比特私有选择：{actor}号首夜连接{first}号与{second}号；底牌和阵营未知。",
  "console.cupid.recognition": "情侣私有互认：{actor}号得知伴侣为{partner}号；底牌和阵营未知。",
  "console.cupid.resolved":
    "上帝关系事实：{actor}号连接{first}号（{firstCamp}）与{second}号（{secondCamp}），来源策略{policy}，人狼恋：{mixed}。",
  "console.cupid.death": "上帝殉情事实：{actor}号死亡牵连{target}号。",
  "replay.stage.cupid_lovers_chosen": "情侣选择",
  "replay.stage.cupid_relation_resolved": "情侣胜利归属",
  "replay.stage.lovers_death": "殉情",
  "reason.cupid_lovers_only_survivors": "情侣完成关系独胜目标",
  "victory.group.cupid_lovers": "丘比特情侣组",
  "stage.black_market_merchant": "黑市商人交易",
  "stage.black_market_recipient": "黑市幸运儿行动",
  "ability.black_market.rules":
    "黑市礼物规则：独立一次库存，领取次夜起140早槽可用，领取当夜不可用。可以留后夜/不调用工具等待不耗，毒药none配任意合法存活编号可跳过，无解药/刀口。查验不可自己，毒可自己；同人同类原生/礼物本夜不得重复同一ID，他人独立。实际死亡永久过期，复活/转移/copy不补库存，原身份/胜利归属不变，donor编号隐藏。",
  "role.black_market_merchant.brief":
    "任意夜一次给另一活人查验、毒药或枪；主动礼物次夜生效，枪实际夜末激活；给狼不授能力且自己天亮不可挡反噬。",
  "role.black_market_merchant.state":
    "你是黑市商人，真实好人神职。130交易阶段任意夜全局一次，用check/poison/gun给另一存活玩家；不调用工具的合法等待只关闭本夜，不耗全局次数。你只保存自己的选择和库存，不获立即成功/阵营反馈或礼物报告。真实Good获得独立礼物且原身份技能不变，真实Wolf（含隐狼）不获通知，你天亮不可挡反噬，守、救、梦均不挡。查验/毒次夜140早槽起可留后夜，收者首次实际死亡永久过期，不copy或补库存；收者不获你的编号。赠枪900实际夜末激活，该夜刀死可在白天开枪，原生枪先、赠枪后，全部枪与死亡链完成才判胜。严格非法提交/取消/网络失败不得伪装成功等待。",
  "role.black_market_merchant.status": "本人交易选择与库存：{state}",
  "action.black_market_trade.hint":
    "black_market_trade：target_id为另一存活正整数编号，skill仅check/poison/gun；可不调用工具合法等待，不可自己/死者/null，合法一次交易后全局机会耗尽。",
  "action.black_market_recipient.directive":
    "当前是黑市幸运儿早槽，只用本轮绑定的独立实例，不耗原生库存。查验不可自验；单毒可自毒，无解药/刀口，none配合法存活编号可跳过。不调用工具的合法等待/none关闭本夜不耗库存。同人同类原生/礼物本夜不能重复命中同一ID，不知道他人选择。首次实际死亡礼物永久过期。",
  "replay.stage.black_market_merchant": "黑市商人交易",
  "replay.stage.black_market_recipient": "黑市受赠能力行动",
  "replay.stage.black_market_trade_committed": "黑市交易选择",
  "replay.stage.black_market_trade_skipped": "黑市等待",
  "replay.stage.black_market_trade_resolved": "上帝黑市结果",
  "black_market.skill.gun": "猎枪",
  "black_market.skill.check": "查验",
  "black_market.skill.poison": "毒药",
  "console.black_market.choice": "【黑市选择】第{day}夜{actor}号给{target}号{skill}。",
  "console.black_market.skip": "{actor}号第{day}夜等待黑市交易。",
  "console.black_market.result":
    "【上帝黑市结果】第{day}夜{actor}号对{target}号的{skill}：{outcome}。",
  "error.black_market_skill": "黑市礼物只可选择check、poison或gun。",
  "death.black_market_backlash": "黑市反噬",
  "prompt.targets.lucky_poison":
    "幸运毒药的合法目标编号：{ids}。保留技能可不调用工具；none始终使用你自己的编号{actor}，不受毒目标列表限制。",
  "action.lucky.directive":
    "当前是幸运儿阶段，本轮只使用绑定的幸运实例；可不调用工具等待到后夜。use_potion仅poison或none（none的target_id须本人），无解药或刀口。guard可守自己/其它活人或target_id:null且abstain:true空守；空守不花一次但关闭本夜，普通守护只挡刀且与解药同守同救相抵消。check_identity不可自验。实际技能使用才花独立的一次库存，原生能力继续按自己的阶段与库存行动。",
  "role.miracle_merchant.brief":
    "好人神职，任意夜一次赠验/毒/守给另一活人；给真狼反噬，幸运技能当夜起一次。",
  "role.miracle_merchant.state":
    "你的真实身份是奇迹商人，好人神职，帮助好人获胜。原生125阶段在其它实际角色前行动；任意夜一次bestow_ability，给另一实际活玩家check、poison或guard，不可self/dead/null。可以不调用工具等待，本夜关闭但不花全局一次。提交以真实阵营判断，给Wolf不授能力且你天亮反噬；普通守护/解药不挡，有效梦可挡但交易仍已用。反噬首夜初批有遗言，晚夜按本局死亡策略。非Wolf获独立一次幸运技能，700阶段在原生技能后从当夜或后夜任选使用；原身份与资源保持。你不立即知道赠予成功或目标阵营，收者不获你的编号，Wolf目标不知被选。你只保自己的选择及剩余次数；已有交易不因目标后死/改阵营重算。非法、迟到或撤权不花新库存，已实际提交的消费前缀保留。首夜必须赠予并非本局规则，谨慎按公开证据选择。",
  "role.miracle_merchant.status": "你的交易选择与库存：{state}。",
  "action.bestow_ability.hint":
    "bestow_ability：target_id为另一存活玩家的整数编号，skill仅check/poison/guard；可不调用工具等待，合法提交一次后不可再赠。",
  "stage.miracle_merchant": "奇迹商人赠予",
  "error.merchant_unavailable": "本夜交易未获授权、已关闭或全局次数已用尽。",
  "error.merchant_target": "请选择自己以外的实际存活玩家；赠予目标不能为null或虚构编号。",
  "error.merchant_skill": "赠予技能只可选择check、poison或guard。",
  "merchant.skill.check": "查验",
  "merchant.skill.poison": "毒药",
  "merchant.skill.guard": "守护",
  "merchant.outcome.granted": "获得幸运技能",
  "merchant.outcome.backlash": "反噬提案",
  "console.merchant.trade": "【奇迹商人】{actor}号第{day}夜对{target}号选择赠予{skill}。",
  "console.merchant.skip": "【奇迹商人】{actor}号第{day}夜未赠予，保留全局一次。",
  "console.merchant.outcome":
    "【上帝交易结果】第{day}夜{actor}号对{target}号的{skill}：{outcome}。",
  "ability.lucky.rules":
    "幸运能力规则：独立一次库存，从收到当夜起在幸运儿阶段700可用，也可留后夜。可不调用工具等待；空守或none不花一次但关闭本夜。实际死亡永久失效，不因复活或转移恢复。原生与幸运技能按同一玩家联合约束：同类技能本夜不能重复同目标；守护还须避开自己前夜两种操作守过的全部目标，不限制别人的选择。幸运查验不可self，幸运毒可self但none须target_id为本人；无解药/刀口，不能读其它玩家原生行动，商人ID不公开。非法或撤权不消耗新实例，已提交消费和效果前缀保留。",
  "ability.lucky.history": "你自己当前及前夜已实际使用的目标：{actions}。",
  "console.lucky.skipped": "{actor}号第{day}夜保留幸运技能{ability}，本夜机会已关闭。",
  "stage.lucky": "幸运儿行动",
  "error.lucky_target_repeat":
    "同一玩家本夜同类技能不可重复同目标；守护也须避开自己前夜所有原生与幸运守护目标。",
  "replay.stage.lucky_ability_skipped": "保留受赠技能",
  "replay.stage.merchant_trade_committed": "奇迹商人赠送选择",
  "replay.stage.merchant_trade_resolved": "上帝奇迹赠送结果",
  "replay.stage.merchant_trade_skipped": "奇迹商人等待",
  "replay.stage.lucky": "受赠能力行动",
  "replay.stage.gift_ability": "受赠能力行动",
  "replay.gift_ability_skipped": "{actor}号第{day}夜保留受赠技能{ability}，本夜机会已关闭。",
} as const satisfies Record<keyof typeof definition.parameters, string>;

export const en = {
  "console.ghost_bride_pair_chosen": "Ghost Bride {bride} and player {groom} are partners.",
  "replay.stage.ghost_bride_pair_chosen": "Wedding fact",
  "console.ghost_bride_group_chosen":
    "Wedding group: bride {bride}, groom {groom}, witness {witness}.",
  "replay.stage.ghost_bride_group_chosen": "Wedding fact",
  "console.ghost_bride_witness_vote":
    "God: player {actor} cast wedding witness vote {vote} for {target}.",
  "replay.stage.ghost_bride_witness_vote": "Wedding fact",
  "console.ghost_bride_partner_chat": "Partner chat: {actor} to {recipient}: {body}",
  "replay.stage.ghost_bride_partner_chat": "Wedding fact",
  "console.ghost_bride_knife_captured":
    "God: wedding knife on night {day} belongs to {owner}; actors {actors}.",
  "replay.stage.ghost_bride_knife_captured": "Wedding fact",
  "console.ghost_bride_knife_vote": "Wedding knife vote: {actor} chose {target}.",
  "replay.stage.ghost_bride_knife_vote": "Wedding fact",
  "console.ghost_bride_knife_resolved": "Wedding knife result on night {day}: {target}.",
  "replay.stage.ghost_bride_knife_resolved": "Wedding fact",
  "console.ghost_bride_partner_death": "God: death of {actor} caused partner {target} to die.",
  "replay.stage.ghost_bride_partner_death": "Wedding fact",
  "wedding.owner.ordinary_pack": "single wolf pack",
  "wedding.owner.pair": "partners",
  "wedding.owner.witness": "witness",
  "wedding.owner.none": "no knife owner",
  "role.ghost_bride.brief":
    "AWA adaptation of the Melbourne three-faction setup: choose a Groom on night one and jointly confirm a Witness. Native roles and stocks stay unchanged; the wedding trio wins independently. Partners recognize and privately chat with each other; one death takes the other. After all single wolves die, the living pair inherits the knife; after both partners die, the Witness inherits it.",
  "role.ghost_bride.state":
    "Your Ghost Bride opening resource: {state}. Groom and Witness retain their native roles and stocks without disclosing them to you.",
  "prompt.status.wedding":
    "Your authorized wedding relation and independent third-party goal: {state}. Eliminate both other factions to win. A partner dying of grief cannot shoot. Only authorized IDs and your knife eligibility appear here, with no partner or Witness role or stock disclosure.",
  "action.choose_bridegroom.hint":
    "On night one choose another living player as Groom. Selection is mandatory, final, and has no default fallback.",
  "action.choose_wedding_witness.hint":
    "Choose a living player outside the couple as Witness. Bride proposes first; Groom must submit the same ID to confirm. Disagreement fails setup without a fallback.",
  "action.speak_to_partner.hint":
    "Send the one authorized message to your original partner. Submit text; an empty string explicitly passes. Witness never receives partner chat.",
  "action.wedding_kill_vote.hint":
    "The inherited knife requires an integer target_id with abstain=false, or target_id=null with abstain=true. Neither partner may target the couple; Witness may not target self.",
  "error.ghost_bride_unavailable":
    "The original wedding life, request budget, or joint authorization is no longer valid.",
  "error.ghost_bride_choice":
    "Submit only the canonical wedding choice authorized for this turn; no default selection is permitted.",
  "stage.ghost_bride_groom": "Ghost Bride chooses Groom",
  "stage.ghost_bride_chat": "Partner chat",
  "stage.ghost_bride_witness": "Joint Witness choice",
  "stage.ghost_bride_knife": "Inherited wedding knife",
  "role.lonely_girl.brief":
    "Before other first-night actions choose another living player to admire. Your personal victory follows their true faction at that choice; you remain a Good civilian with no pack recognition, wolf chat, knife or self-destruct. You do not learn their identity; they are not told they are admired. The AWA policy freezes membership, which survives death.",
  "role.lonely_girl.state":
    "Private Lonely Girl choice state: {state}; the target identity and frozen membership are not directly disclosed to you.",
  "prompt.status.lonely_girl":
    "Current Lonely Girl choice state: {state}. You remain a Good civilian. The target faction is not directly disclosed during play; the final outcome may allow inference.",
  "action.choose_admired_player.hint":
    "On the first night choose another living player to admire; no self-choice, abstention or second choice.",
  "turn.lonely_girl.required":
    "A valid admired player is required; no skip or fabricated fallback.",
  "stage.lonely_girl": "Lonely Girl initial admiration",
  "error.lonely_girl_unavailable":
    "No Lonely Girl first-night scope bound to the original life is available.",
  "error.lonely_girl_choice":
    "The admired target must be another currently authorized living player.",
  "console.lonely_girl.choice": "Lonely Girl {actor} chose to admire player {target}.",
  "console.lonely_girl.god":
    "Lonely Girl {actor} chose to admire player {target}; personal victory membership is {camp}.",
  "replay.stage.lonely_girl_admired_chosen": "Lonely Girl private choice",
  "role.wild_child.brief":
    "Starts with Good villagers. Choose a model on the first night. If your model is eliminated while you remain alive, become Wolf and join pack knowledge, chat and knife voting on the following night. No copied skills or self-destruct.",
  "role.wild_child.state":
    "The initial Good introduction is historical. Current true faction: {camp}; your model and stage: {state}. Chosen remains Good; transformed is truly Wolf without pack access; active grants mutual recognition, chat and knife voting.",
  "prompt.status.wild_child":
    "Your Wild Child state: {state}. No model role, faction or hidden cause is revealed. No reselection or revival refresh.",
  "action.choose_wild_model.hint":
    "Choose one other living player as your model on night one, once per game. Submit target_id only; their role and faction stay hidden.",
  "turn.wild_child.required": "A valid model is required; no skip or fabricated fallback.",
  "stage.wild_child": "Wild Child initial model choice",
  "error.wild_child_unavailable":
    "No Wild Child first-night choice is authorized for this original life.",
  "error.wild_child_choice": "The model must be another currently authorized living player.",
  "console.wild_child.choice": "Wild Child {actor} chose player {target} as model.",
  "console.wild_child.death":
    "Wild Child {actor}'s model, player {target}, actually died; causes: {causes}.",
  "console.wild_child.transform":
    "Wild Child {actor} now belongs to Wolf; pack access is eligible from night {night}.",
  "console.wild_child.active":
    "Wild Child {actor} joined the pack on night {night}: mutual recognition, chat and knife voting are active.",
  "replay.stage.wild_child_model_chosen": "Wild Child private fact",
  "replay.stage.wild_child_model_eliminated": "Wild Child private fact",
  "replay.stage.wild_child_transformed": "Wild Child private fact",
  "replay.stage.wild_child_pack_activated": "Wild Child private fact",
  "action.write_note.hint":
    "Optional anonymous note: submit your own free text with write_note, 1–160 Unicode codepoints, not all whitespace. Original text is preserved. Notes are collected then published in random order without author links.",
  "request.summary.wall_notes":
    "Optionally submit one anonymous note; your paper expires when this window closes.",
  "stage.wall_notes": "Anonymous wall note",
  "error.wall_note_unavailable": "No authorized unspent personal wall note is available.",
  "error.wall_note_text": "Use 1–160 Unicode codepoints, not all whitespace or malformed UTF-16.",
  "prompt.status.wall_note":
    "Your personal anonymous paper instance and effective stock: {state}. Other authors’ submissions are hidden.",
  "item.operation.granted": "granted",
  "item.operation.accepted": "accepted",
  "item.operation.rejected": "rejected",
  "item.operation.revoked": "revoked",
  "item.operation.expired": "expired",
  "replay.stage.wall_notes_started": "Wall note fact",
  "replay.stage.wall_notes_published": "Wall note fact",
  "replay.stage.wall_notes_canceled": "Wall note fact",
  "replay.stage.wall_note_changed": "Wall note fact",
  "replay.stage.wall_note_order_recorded": "Wall note fact",
  "role.debater.brief":
    "Once per game challenge the current ordinary speaker. Every living player casts a sealed ballot; a strict majority blocks the target’s exile vote, otherwise yours.",
  "role.debater.state":
    "You are the Good god Debater. AWA adapts Melbourne 2026: challenge only the designated other living ordinary exile speaker, once per game. Acceptance publicly reveals you and immediately spends the opportunity. You speak first, then the target; every living player frozen at the start, including both participants and a revealed Idiot, votes anonymously. Strictly more than half supporting succeeds: cancel only the target’s current ordinary speech and block their ordinary and PK exile votes today. Otherwise block yours. Success against the sheriff automatically transfers the badge to you with its configured weight. Sheriff elections and PK speeches are unaffected. Cancellation after acceptance does not refund the opportunity.",
  "role.debater.status": "Your effective opportunity and recorded choice: {state}.",
  "action.challenge.hint":
    "Use challenge with this window’s unique target_id, or pass to keep the opportunity.",
  "action.debate_vote.hint":
    "Sealed ballot: support=true supports Debater, false opposes, null abstains. Exile vote weights do not apply.",
  "prompt.targets.debate":
    "The only legal challenge target_id in this window is {target}. No self or other ID.",
  "prompt.status.debate_penalty":
    "Your ordinary and PK exile votes are blocked today; sealed debate ballots and sheriff elections are unaffected.",
  "error.debate_unavailable": "No authorized unspent Debater window is active.",
  "error.debate_target": "Challenge only the designated other living speaker.",
  "error.debate_ballot":
    "Only an authorized current living participant may submit true, false or null.",
  "console.debate.reveal": "Player {actor} publicly reveals as Debater and remains alive.",
  "console.debate.start": "Player {actor} challenges player {target}.",
  "console.debate.speech": "Debate statement (player {actor}): {speech}",
  "console.debate.cancel":
    "Player {actor}’s challenge to {target} was canceled after scope changed; the spent opportunity is not refunded.",
  "console.debate.ledger":
    "God ledger: sealed ballots for player {actor}’s challenge to {target} have been collected.",
  "console.debate.result":
    "Player {actor} challenges {target}: {eligible} participants, {supports} support, {rejects} oppose, {abstentions} abstain; success: {result}; player {blocked} cannot cast exile votes today.",
  "request.summary.debate_challenge": "Challenge the designated player {target}?",
  "request.summary.debate_speech": "Submit your public debate statement.",
  "request.summary.debate_ballot": "Cast a sealed ballot supporting or opposing Debater.",
  "stage.debate_challenge": "Debater challenge choice",
  "stage.debate_speech": "Both debate statements",
  "stage.debate_ballot": "Sealed debate ballot",
  "replay.stage.debater_revealed": "Debater revelation",
  "replay.stage.debate_started": "Challenge",
  "replay.stage.debate_speech": "Debate statement",
  "replay.stage.debate_resolved": "Debate result",
  "replay.stage.debate_canceled": "Debate canceled",
  "replay.stage.debate_ballots_recorded": "God sealed ballot ledger",
  "rule.netease_2017_cupid_follows_lovers_v1": "NetEase 2017: Cupid follows lovers",
  "rule.lui_meme_lovers_only_v1": "Lui-même original: separate Cupid follows Good",
  "rules.lovers.netease":
    "Lovers rules (NetEase 2017): lovers learn only their partner ID, never the partner's role, faction or hidden victory affiliation. Original roles, abilities, inspection results and wolf permissions stay unchanged. Either death causes the other to die of heartbreak; protection cannot prevent it and heartbreak blocks death abilities. Two Good lovers win with Good; two Wolf lovers win with Wolf. Mixed lovers must both survive and eliminate everyone except themselves and Cupid. Cupid always wins with the pair, even if already dead. This policy adds no mutual exile-vote ban. These are conditional rules, not disclosure of your partner's faction.",
  "rules.lovers.lui":
    "Lovers rules (Lui-même): lovers learn only their partner ID, never the partner's role, faction or hidden victory affiliation. Original roles, abilities, inspection results and wolf permissions stay unchanged. Either death causes the other to die of heartbreak; protection cannot prevent it and heartbreak blocks death abilities. Two Good lovers win with Good; two Wolf lovers win with Wolf. Mixed lovers must both survive and eliminate everyone else, including an unselected Cupid. An unselected Cupid stays with Good; a selected Cupid follows the pair. Lovers cannot vote to exile each other, including PK; sheriff voting is unaffected. These are conditional rules, not disclosure of your partner's faction.",
  "prompt.status.lovers_vote":
    "This source policy forbids lovers from voting to exile each other, including PK.",
  "role.shapeshifter.brief":
    "Before other first-night skills, choose an undealt card; any ordinary Werewolf card forces a Werewolf choice.",
  "role.shapeshifter.state":
    "You begin as Many-Faced One, a Good civilian. Before every other night-one skill inspect only your two undealt cards and choose one. Any ordinary Werewolf forces a Werewolf slot; two Werewolves allow either. You cannot retain Many-Faced One. The swap installs the true role, faction, victory membership and fresh native stock for this night; ID, life, badge, vote and history remain. Your own opportunity: {state}.",
  "action.choose_shapeshifter_card.hint":
    "choose_shapeshifter_card takes only integer slot 0 or 1 in your allowedSlots. Every combination requires a choice; any Werewolf forces a Werewolf slot. No null, retain, player ID, extra field or automatic fallback.",
  "stage.shapeshifter": "Many-Faced One mandatory initial choice",
  "replay.stage.shapeshifter_initial_deal": "Many-Faced One God initial deal",
  "replay.stage.shapeshifter_identity_chosen": "Many-Faced One identity choice",
  "error.shapeshifter_unavailable":
    "Your original identity, physical cards or initial choice authority has closed or been revoked.",
  "error.shapeshifter_choice":
    "Submit only integer slot 0 or 1 in your allowedSlots. Any Werewolf forces a Werewolf slot; no retain or extra fields.",
  "prompt.board.shapeshifter":
    "The counts above describe N+2 candidate cards: only N actual players and two unknown undealt cards. Do not infer in-play role counts; Many-Faced One may be undealt.",
  "prompt.status.shapeshifter":
    "Your own initial opportunity and authorized undealt cards, visible only to you: {state}.",
  "console.shapeshifter.deal":
    "Many-Faced One God initial full N+2 deal: {roles}; {size} actual players.",
  "console.shapeshifter.choice":
    "Private Many-Faced One player {actor} selects card slot {slot}; current true role {role}, faction {camp}.",
  "console.shapeshifter": "Many-Faced One identity fact",
  "turn.shapeshifter.required":
    "Submit one choose_shapeshifter_card with integer slot in your allowedSlots. Any Werewolf forces a Werewolf slot; no retain or automatic fallback.",
  "role.thief.brief":
    "Inspect two undealt cards on night one; you may swap one, and must swap if both are ordinary Werewolves.",
  "role.thief.state":
    "You start as Thief, a Good civilian. Before all night-one identity activation inspect only your two undealt cards: if both are ordinary Werewolves choose slot0 or slot1; otherwise you may wait to retain Thief or select either slot. No other identities or actual dealt role counts are disclosed. A swap installs the true new role, faction, victory membership and fresh native stock for this same night; your player ID, life, badge, vote and session/history remain. This happens once, with no copied or gifted skill. Your current opportunity: {state}.",
  "action.choose_thief_card.hint":
    "choose_thief_card requires integer slot 0 or 1 for your undealt-card slot, never a player ID or null. Both Werewolves require a choice with no fallback; other combinations allow a clean wait to retain Thief.",
  "stage.thief": "Thief initial identity choice",
  "replay.stage.thief_initial_deal": "God initial deal",
  "replay.stage.thief_identity_chosen": "Thief identity choice",
  "error.thief_unavailable":
    "Thief identity or undealt-card authority has closed or been revoked; this request cannot choose.",
  "error.thief_choice": "Submit only integer slot 0 or 1; no player ID, null or extra fields.",
  "prompt.board.thief":
    "With Thief the counts above describe N+2 candidate cards. Only N cards are dealt to N players and two remain undealt; actual in-play role counts are unknown and must not be inferred from candidate counts.",
  "prompt.status.thief":
    "Your own Thief opportunity and currently authorized undealt cards, visible only to you: {state}.",
  "console.thief.deal": "God initial full N+2 deal: {roles}; {size} actual players.",
  "console.thief.choice":
    "Private Thief player {actor} selects card slot {slot}; current true role {role}, faction {camp}.",
  "console.thief.keep":
    "Private Thief player {actor} retains Thief; the initial opportunity has closed.",
  "console.thief": "Thief identity fact",
  "turn.thief.required":
    "Both undealt cards are Werewolves: submit one choose_thief_card(slot0 or slot1), with no automatic fallback.",
  "turn.thief.optional":
    "You may submit one choose_thief_card(slot0 or slot1), or wait to retain Thief; no automatic fallback.",
  "role.cupid.brief":
    "Connect two lovers on night one; either death causes heartbreak, which suppresses death abilities. Victory uses a named source policy.",
  "role.cupid.state":
    "Your role is Cupid, a true Good god. On your first-night turn, choose two distinct living players with choose_lovers; you may include yourself. No empty, duplicate or dead target, passing or later choice. After commitment you cannot change them. You learn only your selected IDs, never their roles, factions or hidden victory group. Lovers learn only their partner ID and keep original abilities, inspection results and wolf permissions. Either death causes the other to die of heartbreak, which blocks guns and Wolf Beauty death links and ignores protection. If both are killed independently in the same death wave, both still suffer heartbreak and lose the corresponding death abilities. Already effective Dreamer links still follow night death. Victory waits for the entire death chain.",
  "role.cupid.netease":
    "Source policy: NetEase 2017. You always win with the lovers. Two Good lovers follow Good; two Wolf lovers follow Wolf, but this grants you no wolf knowledge or knife and never counts you as a true wolf. Mixed lovers must both survive and eliminate everyone except themselves and you; you win with them whether alive or dead. When following Wolf or the relationship group, you no longer block Wolf slaughter of Good. All true wolves dying still awards Good victory. The source does not specify a mutual-vote ban; current AWA voting permission is retained.",
  "role.cupid.lui":
    "Source policy: Lui-même original. An unselected Cupid stays with Good and counts as Good. Mixed lovers must both survive and eliminate everyone else, including a separate Cupid. A selected Cupid follows the pair. Lovers cannot vote to exile each other, including PK; sheriff elections are unaffected.",
  "role.cupid.status":
    "Your own chosen IDs and opportunity: {state}. The moderator has not told you the lovers' roles or factions.",
  "action.choose_lovers.hint":
    "Choose two distinct living IDs using first_id and second_id; self is allowed and passing is forbidden.",
  "prompt.targets.lovers":
    "Select first_id and second_id separately from actually living IDs: {ids}. They must differ; self is allowed.",
  "stage.cupid": "Cupid lover selection",
  "error.cupid_unavailable":
    "Cupid selection requires the original authorized, unused choice on night one.",
  "error.cupid_target": "Choose two distinct actually living integer IDs; self is allowed.",
  "error.lovers_vote":
    "The current original policy forbids lovers from voting to exile each other.",
  "console.cupid.choice":
    "Cupid private choice: player {actor} connected players {first} and {second} on night one; roles and factions are unknown.",
  "console.cupid.recognition":
    "Lover private recognition: player {actor} learned that player {partner} is their partner; role and faction are unknown.",
  "console.cupid.resolved":
    "God relationship fact: player {actor} connected player {first} ({firstCamp}) and player {second} ({secondCamp}); source policy {policy}; mixed pair: {mixed}.",
  "console.cupid.death":
    "God heartbreak fact: player {actor} died, causing player {target} to die.",
  "replay.stage.cupid_lovers_chosen": "Lover selection",
  "replay.stage.cupid_relation_resolved": "Lover victory affiliation",
  "replay.stage.lovers_death": "Heartbreak",
  "reason.cupid_lovers_only_survivors": "Lovers completed the relationship victory goal",
  "victory.group.cupid_lovers": "Cupid lovers",
  "stage.black_market_merchant": "Black Market trade",
  "stage.black_market_recipient": "Black Market recipient",
  "ability.black_market.rules":
    "Black Market gift rules: one independent use, first available next night in early stage 140, not on the receiving night. You may hold it or wait without spending; poison none uses any valid living target ID. No heal or knife information. Inspection excludes self; poison may target self. Same actor and same kind cannot hit the same ID twice this night across native/gift slots. Other actors are independent. Death permanently expires the gift; no revival, transfer or copy refill. Your original role and victory affiliation remain unchanged; donor ID is hidden.",
  "role.black_market_merchant.brief":
    "Once per game give another living player one inspection, poison or gun. Active gifts start next night; guns arm at actual night end. A Wolf target gets nothing and causes your unblockable dawn backlash.",
  "role.black_market_merchant.state":
    "You are Black Market Merchant, a true Good god. Stage 130 trades once in any night with another living player using check, poison or gun. A clean tool-free wait closes this night without spending the game use. You retain only your choice and inventory, not immediate success, faction or gift reports. A true Good target keeps their original identity and skills and receives an independent gift; a true Wolf (including Hidden Wolf) receives no notification, and you suffer unpreventable backlash at dawn. Guard, heal and Dream do not stop it. Inspection and poison start in early recipient stage 140 on the next night, can be held, and expire on the recipient's first actual death; no copying or refill. The recipient never learns your number. A gifted gun actually arms at night end 900 and may fire on that night's knife death during Day, after any native gun. Complete both stocks and death chains before judging. Strict invalid actions or transport errors must not become a successful wait.",
  "role.black_market_merchant.status": "Your private trade choice and inventory: {state}",
  "action.black_market_trade.hint":
    "black_market_trade: target_id is another living positive integer; skill is check, poison or gun. A clean tool-free wait is allowed; no self, dead or null target. One accepted trade spends your game use.",
  "action.black_market_recipient.directive":
    "Early Black Market recipient stage: use only this bound independent instance. No native stock is consumed. Inspection cannot target yourself. Poison can target yourself, offers no heal or knife knowledge, and none passes with a valid living target ID. Clean tool-free wait or poison none closes this night without spending. Same actor and same kind cannot hit the same ID twice this night across native/gift slots; others' choices are not known. First actual death permanently expires the gift.",
  "replay.stage.black_market_merchant": "Black Market trade",
  "replay.stage.black_market_recipient": "Black Market gifted ability action",
  "replay.stage.black_market_trade_committed": "Black Market choice",
  "replay.stage.black_market_trade_skipped": "Black Market wait",
  "replay.stage.black_market_trade_resolved": "God Black Market result",
  "black_market.skill.gun": "Gun",
  "black_market.skill.check": "Inspection",
  "black_market.skill.poison": "Poison",
  "console.black_market.choice":
    "Black Market choice: player {actor} offered {skill} to player {target} on night {day}.",
  "console.black_market.skip": "Player {actor} passed Black Market trade on night {day}.",
  "console.black_market.result":
    "God Black Market result: player {actor} to player {target}, {skill}, night {day}: {outcome}.",
  "error.black_market_skill": "Choose check, poison or gun as the Black Market gift.",
  "death.black_market_backlash": "Black Market backlash",
  "prompt.targets.lucky_poison":
    "Legal poison target IDs for this lucky instance: {ids}. To hold the skill, pass without a tool; none always uses your own ID {actor}, independently of the poison target list.",
  "action.lucky.directive":
    "This is the Lucky recipient stage. Use only this turn's bound lucky instance, or pass without a tool and hold it for later. use_potion accepts poison or none only (none target_id must be yourself); no antidote or knife information. guard may target self/another living player, or target_id:null with abstain:true for empty guard. Empty guard closes this night without spending the use; ordinary guard blocks knives only and cancels with simultaneous Heal. check_identity cannot target self. An actual skill use spends one independent charge; native skills retain their own stage and inventory.",
  "role.miracle_merchant.brief":
    "Good god. Once in any night bestow check/poison/guard on another living player; a true wolf causes backlash. A lucky gift has one use from that night.",
  "role.miracle_merchant.state":
    "Your true role is Miracle Merchant, a Good god, helping Good win. Your native stage 125 acts before other actual roles. Once in any night use bestow_ability to give check, poison or guard to another actually living player; no self/dead/null. Passing without a tool closes this night without spending the one game use. The committed trade uses the true faction: a Wolf receives no skill and you suffer backlash at dawn. Ordinary Guard/Heal do not block it; an effective Dream does, but the trade stays spent. An initial first-night backlash grants last words; later nights follow this board's death policy. A non-Wolf receives one independent lucky use in stage 700 after native skills, available that night or held for a later night; original identity and resources stay unchanged. You receive no immediate success or faction result; the recipient does not learn your number, and a Wolf target is not notified. You retain only your own choice and remaining count; later target death/faction change never reclassifies a committed trade. Invalid/late/revoked decisions cannot spend new inventory; consumption already committed is preserved. You may wait on night one and choose from public evidence.",
  "role.miracle_merchant.status": "Your trade choice and inventory: {state}.",
  "action.bestow_ability.hint":
    "bestow_ability: target_id is another living integer player ID; skill is check, poison or guard. You may pass without a tool; after one committed trade no second gift is allowed.",
  "stage.miracle_merchant": "Miracle Merchant trade",
  "error.merchant_unavailable":
    "This trade is unauthorized, closed for the night, or already spent for the game.",
  "error.merchant_target":
    "Choose another actually living player; a trade target cannot be null or an invented ID.",
  "error.merchant_skill": "Choose check, poison or guard as the gifted skill.",
  "merchant.skill.check": "Inspection",
  "merchant.skill.poison": "Poison",
  "merchant.skill.guard": "Guard",
  "merchant.outcome.granted": "Received a lucky gift",
  "merchant.outcome.backlash": "Backlash proposal",
  "console.merchant.trade":
    "Miracle Merchant player {actor} chose to bestow {skill} on player {target} on night {day}.",
  "console.merchant.skip": "Miracle Merchant player {actor} held the one trade on night {day}.",
  "console.merchant.outcome":
    "God trade result: player {actor} to player {target}, {skill}, night {day}: {outcome}.",
  "ability.lucky.rules":
    "Lucky ability rules: one independent use, available in lucky stage 700 from the receiving night or held for a later night. Passing without a tool, empty guard or none closes this night without spending the use. Actual death permanently expires it; revival or transfer never restores it. Your native and lucky actions share actor-local target constraints: no repeated target for the same skill kind this night; Guard also avoids every target you guarded with either skill last night. Other players are unrestricted by your choices. Lucky inspection cannot target self; poison may target self, but none requires your own target_id. No antidote/knife information, no other players' native actions, no merchant ID. Invalid/revoked actions do not spend a new instance; committed consumption and effects retain their prefix.",
  "ability.lucky.history":
    "Your own actually used targets from this and the previous night: {actions}.",
  "console.lucky.skipped":
    "Player {actor} holds lucky ability {ability} on night {day}; this night's opportunity is closed.",
  "stage.lucky": "Lucky recipient action",
  "error.lucky_target_repeat":
    "The same player cannot repeat a target with the same skill kind this night. Guard must also avoid all of that player's native and lucky guard targets from the previous night.",
  "replay.stage.lucky_ability_skipped": "Gifted ability held",
  "replay.stage.merchant_trade_committed": "Miracle Merchant gift choice",
  "replay.stage.merchant_trade_resolved": "God-view Miracle Merchant gift result",
  "replay.stage.merchant_trade_skipped": "Miracle Merchant waits",
  "replay.stage.lucky": "Gifted ability action",
  "replay.stage.gift_ability": "Gifted ability action",
  "replay.gift_ability_skipped":
    "Player {actor} holds gifted ability {ability} on night {day}; this night’s opportunity is closed.",
} satisfies Record<keyof typeof definition.parameters, string>;

// 三份原数据一起交 catalog；satisfies 只作编译期 key 对齐，最终公开字典的冻结由 catalog 负责。
export const messages = { definition, zhCN, en };
