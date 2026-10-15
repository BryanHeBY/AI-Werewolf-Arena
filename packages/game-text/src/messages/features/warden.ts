/**
 * 负责典狱长工具、秘密事实与规则的中英文固定模板。输入为稳定key及纯参数，输出自然语言；
 * 文案不查询World或公开对方未披露的身份、决定与完成状态。
 */
import type { MessageDefinition } from "../definition";
export const definition = {
  owner: "features/warden",
  parameters: {
    "role.warden.brief": [],
    "role.warden.state": ["ids"],
    "action.warden_pair.hint": [],
    "action.warden_pair.directive": [],
    "action.warden_decide.hint": [],
    "action.warden_decide.directive": [],
    "stage.warden_pair": [],
    "stage.warden_decide": [],
    "request.summary.warden_pair": [],
    "request.summary.warden_decide": [],
    "prompt.config.warden": [],
    "prompt.stage.warden_candidates": ["ids"],
    "prompt.stage.warden_partner": ["partner"],
    "prompt.stage.warden_forced": ["target"],
    "event.warden_pair_chosen": ["actor", "day", "pair"],
    "event.warden_partner_notified": ["actor", "day", "partner"],
    "event.warden_decision": ["actor", "choice", "day"],
    "event.warden_resolved": ["day", "deaths", "outcome", "pair"],
    "warden.choice.trade": [],
    "warden.choice.betray": [],
    "warden.outcome.protect": [],
    "warden.outcome.force": [],
    "warden.outcome.deal": [],
    "death.deal": [],
    "replay.stage.warden_pair_chosen": [],
    "replay.stage.warden_partner_notified": [],
    "replay.stage.warden_decision": [],
    "replay.stage.warden_resolved": [],
  },
} as const satisfies MessageDefinition;
export const zhCN = {
  "role.warden.brief":
    "典狱长属于狼队。首夜不能交易；次夜起可指定两名不同的未参与存活玩家秘密博弈，可含自己，每人整局最多参与一次。普通双方交易免本夜夜刀、毒及梦伤；单背叛使交易者以交易死因出局；双背叛仅把双方各自已有的原生个人夜技能强制指向对方，团刀不变。自己入局则同选自己死、异选对方死。选择及结果秘密，不能获得对方选择。",
  "role.warden.state":
    "已使用参与资格：{ids}。主持者只知道自己指定的pair，不能得知其他参与者决定。",
  "action.warden_pair.hint":
    "target_ids为两名不同候选的数组，或明确null空过。每名玩家整局只参与一次。",
  "action.warden_pair.directive": "仅提交一次秘密pair；不要推断参与者身份或未公开决定。",
  "action.warden_decide.hint": "choice只能为trade或betray。你只知道对方座位，不能看到其选择。",
  "action.warden_decide.directive":
    "独立提交交易或背叛，不根据对方完成状态推理。缺失不是交易或背叛。",
  "stage.warden_pair": "典狱长配对",
  "stage.warden_decide": "秘密交易决定",
  "request.summary.warden_pair": "选择本夜秘密交易的两名参与者或明确空过",
  "request.summary.warden_decide": "独立提交秘密交易决定",
  "prompt.config.warden":
    "本局启用典狱长AWA交易与原生技能强制对方政策；N2起在摄梦、狼聊及团刀前选择。每人整局一次；双交易不免Deal或Shot；团刀不受双背叛影响。",
  "prompt.stage.warden_candidates": "本次尚未参与的存活候选：{ids}。只能选不同两人或null。",
  "prompt.stage.warden_partner":
    "本次秘密交易对象为{partner}号。没有获得对方身份、决定或完成状态。",
  "prompt.stage.warden_forced":
    "本夜双背叛已生效：本人的原生个人技能仅可指向{target}号；女巫可明确none，救药仍须真实刀口且原规则合法。团刀票不受影响。",
  "event.warden_pair_chosen": "第{day}夜典狱长{actor}号指定秘密交易pair：{pair}。",
  "event.warden_partner_notified": "第{day}夜，{actor}号的秘密交易对象为{partner}号。",
  "event.warden_decision": "第{day}夜，{actor}号秘密选择{choice}。",
  "event.warden_resolved": "第{day}夜秘密博弈（{pair}）结算：{outcome}；交易死亡目标：{deaths}。",
  "warden.choice.trade": "交易",
  "warden.choice.betray": "背叛",
  "warden.outcome.protect": "双方夜间保护",
  "warden.outcome.force": "双方原生个人技能强制对方",
  "warden.outcome.deal": "交易死亡提案",
  "death.deal": "交易",
  "replay.stage.warden_pair_chosen": "秘密配对",
  "replay.stage.warden_partner_notified": "交易对象通知",
  "replay.stage.warden_decision": "秘密交易决定",
  "replay.stage.warden_resolved": "全知交易结算",
} as const;
export const en = {
  "role.warden.brief":
    "Warden is a wolf. No trade on night 1. From night 2, optionally pair two distinct unused living players, including yourself; each player participates once per game. Mutual trade prevents ordinary knife, poison and Dream harm that night. A single betrayer kills the trader by Deal. Mutual betrayal forces existing native personal night skills to the partner; pack knife is unchanged. With yourself paired, matching choices kill you and different choices kill the other player. Choices and results remain secret.",
  "role.warden.state":
    "Used participation seats: {ids}. Hosting reveals your chosen pair, not other participants’ decisions.",
  "action.warden_pair.hint":
    "target_ids is two distinct disclosed candidates, or explicit null to pass. Each player participates once per game.",
  "action.warden_pair.directive":
    "Submit one secret pair. Do not infer participants’ identities or undisclosed decisions.",
  "action.warden_decide.hint":
    "choice must be trade or betray. Only the partner seat is disclosed; their decision is sealed.",
  "action.warden_decide.directive":
    "Independently choose trade or betray. Do not infer another player’s completion status. A missing reply is neither choice.",
  "stage.warden_pair": "Warden pairing",
  "stage.warden_decide": "Sealed trade decision",
  "request.summary.warden_pair": "Choose two secret participants or explicitly pass",
  "request.summary.warden_decide": "Submit your sealed trade decision",
  "prompt.config.warden":
    "Warden uses the AWA trade and native-partner policy, from night 2 before Dream, pack chat and knife. Each seat participates once. Mutual trade does not block Deal or Shot; mutual betrayal does not alter pack knife.",
  "prompt.stage.warden_candidates":
    "Unused living candidates: {ids}. Choose two distinct seats or null.",
  "prompt.stage.warden_partner":
    "Your sealed trade partner is player {partner}. Their identity, choice and completion status are undisclosed.",
  "prompt.stage.warden_forced":
    "Mutual betrayal is active: your native personal night skill may target only player {target}. Witch may explicitly choose none; heal still requires the true knife target and original legality. Pack knife votes are unaffected.",
  "event.warden_pair_chosen": "Night {day}: Warden {actor} selects sealed pair: {pair}.",
  "event.warden_partner_notified":
    "Night {day}: player {actor} has sealed trade partner {partner}.",
  "event.warden_decision": "Night {day}: player {actor} secretly chooses {choice}.",
  "event.warden_resolved":
    "Night {day}: sealed pair ({pair}) resolves as {outcome}; Deal death targets: {deaths}.",
  "warden.choice.trade": "trade",
  "warden.choice.betray": "betray",
  "warden.outcome.protect": "mutual night protection",
  "warden.outcome.force": "native personal skills forced to partner",
  "warden.outcome.deal": "Deal death proposal",
  "death.deal": "Deal",
  "replay.stage.warden_pair_chosen": "Secret pairing",
  "replay.stage.warden_partner_notified": "Partner notice",
  "replay.stage.warden_decision": "Sealed decision",
  "replay.stage.warden_resolved": "Omniscient trade resolution",
} satisfies Record<keyof typeof definition.parameters, string>;
export const messages = { definition, zhCN, en };
