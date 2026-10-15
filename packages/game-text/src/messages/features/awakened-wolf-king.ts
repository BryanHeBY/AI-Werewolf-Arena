/**
 * 负责觉醒狼王与受传狼爪的两语规则、库存、工具及事实模板。输入为稳定消息与纯参数，输出自然语言。
 * 私有库存不是公开身份，消费不代表死亡；源单位与许可由机制拥有，本词典不访问World或修改用户原文。
 */
import type { MessageDefinition } from "../definition";
export const definition = {
  owner: "features/awakened-wolf-king",
  parameters: {
    "role.awakened_wolf_king.brief": [],
    "role.awakened_wolf_king.state": ["bequests", "units"],
    "action.bequeath_claw.hint": [],
    "action.bequeath_claw.directive": [],
    "stage.awakened_claw_bequest": [],
    "request.summary.awakened_claw_bequest": [],
    "prompt.config.awakened_wolf_king": [],
    "prompt.stage.claw_bequest_candidates": ["ids"],
    "awakened_claw.received.brief": [],
    "awakened_claw.unit.native": ["index", "status"],
    "awakened_claw.unit.bequest": ["day", "giver", "status"],
    "awakened_claw.status.ready": [],
    "awakened_claw.status.spent": [],
    "awakened_claw.status.transferred": [],
    "awakened_claw.status.expired": [],
    "awakened_claw.bequest": ["day", "target"],
    "event.awakened_claw_bequeathed": ["actor", "day", "target"],
    "event.awakened_claw_spent": ["actor", "day", "target"],
    "event.awakened_claw_passed": ["actor", "day"],
    "event.awakened_claws_expired": ["actor", "count", "day"],
    "replay.stage.awakened_claw_bequeathed": [],
    "replay.stage.awakened_claw_spent": [],
    "replay.stage.awakened_claws_expired": [],
  },
} as const satisfies MessageDefinition;
export const zhCN = {
  "role.awakened_wolf_king.brief":
    "觉醒狼王属于狼队，拥有两枚独立狼爪。每夜可将一枚尚未使用的狼爪传给另一合法活队友，或明确不传；已传不返还。仅真实狼刀、放逐或枪击且全部死因均允许时，死亡后按原爪库存依次行动；毒、梦、自爆、决斗和未知死因禁爪。每爪可选活人或明确空枪，均消费；第一爪完整死亡连锁后才轮到下一爪。",
  "role.awakened_wolf_king.state":
    "狼爪库存：{units}。已付传授记录：{bequests}。这些是本人知识，不是当前死亡窗口或行动许可。",
  "action.bequeath_claw.hint":
    "target_id只可为本轮告知的另一活队友，或显式null表示不传。不得填写来源、剩余数或单位ID。",
  "action.bequeath_claw.directive":
    "本次只调用bequeath_claw，传一枚原生可用爪或明确空过。候选名单是本人获知信息，实际原生命与库存仍由引擎复验。",
  "stage.awakened_claw_bequest": "狼爪亲传",
  "request.summary.awakened_claw_bequest": "选择亲传狼爪的队友或明确不传",
  "prompt.config.awakened_wolf_king":
    "觉醒狼王采用AWA双爪与亲传政策：每夜狼聊后、刀票前可传一枚给另一合法活队友，null不消费。每份原生或受传爪独立付款；许可死因下按真实死亡连锁逐次开枪，空枪消费，毒、梦、自爆、决斗及未知复合来源禁爪。中立公开枪击不认证持爪来源或原身份。",
  "prompt.stage.claw_bequest_candidates":
    "本轮可亲传狼爪的队友：{ids}；也可显式target_id=null，不消耗狼爪。",
  "awakened_claw.received.brief":
    "你持有一枚亲传狼爪，不改变原身份与其它技能，不能再次转传。仅当真实死亡的全部来源都允许时获得一次独立死亡行动；明确空枪也消耗。投毒、梦、自爆、决斗或未知来源死亡则失效。",
  "awakened_claw.unit.native": "原生第{index}爪：{status}",
  "awakened_claw.unit.bequest": "第{day}夜由{giver}号传入的爪：{status}",
  "awakened_claw.status.ready": "尚可使用",
  "awakened_claw.status.spent": "已消耗",
  "awakened_claw.status.transferred": "已传出，不返还",
  "awakened_claw.status.expired": "已失效",
  "awakened_claw.bequest": "第{day}夜传给{target}号",
  "event.awakened_claw_bequeathed": "第{day}夜，{actor}号将一枚狼爪亲传给{target}号。",
  "event.awakened_claw_spent":
    "第{day}天，{actor}号消耗一枚狼爪，选择{target}号为目标；实际死亡另行结算。",
  "event.awakened_claw_passed": "第{day}天，{actor}号明确空枪并消耗一枚狼爪。",
  "event.awakened_claws_expired": "第{day}天，{actor}号剩余{count}枚狼爪失效。",
  "replay.stage.awakened_claw_bequeathed": "狼爪亲传（双方私有）",
  "replay.stage.awakened_claw_spent": "狼爪消费（本人私有）",
  "replay.stage.awakened_claws_expired": "狼爪失效（上帝私有）",
};
export const en = {
  "role.awakened_wolf_king.brief":
    "The Awakened Wolf King is a wolf with two independent claws. Each night, bequeath one ready claw to another eligible living teammate or explicitly pass; transfers never return. On actual death, only wolf attack, exile or shooting qualifies, and every death source must qualify. Poison, dreams, self-destruction, duels and unknown sources disable claws. Each claw may target a living player or explicitly pass; either consumes it. The first claw’s full death chain resolves before the next decision.",
  "role.awakened_wolf_king.state":
    "Your claw inventory: {units}. Committed bequests: {bequests}. This is personal knowledge, not a current death window or action authorization.",
  "action.bequeath_claw.hint":
    "target_id must be another living teammate in the supplied candidates, or explicit null to pass. Do not supply a source, remaining count or unit ID.",
  "action.bequeath_claw.directive":
    "Use only bequeath_claw to transfer one ready native claw or explicitly pass. Candidates are supplied knowledge; the engine rechecks original lives and inventory.",
  "stage.awakened_claw_bequest": "Claw bequest",
  "request.summary.awakened_claw_bequest":
    "Choose a teammate to receive one claw or explicitly pass",
  "prompt.config.awakened_wolf_king":
    "The Awakened Wolf King uses the AWA claws and bequest policy: after night chat and before knife votes, one ready claw may be transferred to another eligible living teammate; null costs nothing. Each native or received claw is paid independently, with real death chains between shots. Passing a shot consumes the claw. Poison, dreams, self-destruction, duels and any unknown combined source disable claws. Neutral public shots do not certify the claw source or original role.",
  "prompt.stage.claw_bequest_candidates":
    "Eligible teammates for this bequest: {ids}; explicit target_id=null passes without consuming a claw.",
  "awakened_claw.received.brief":
    "You hold one received claw. Your original role and other abilities remain; this claw cannot be transferred again. A separate death action opens only when every actual death source qualifies. Explicitly passing consumes it. Poison, dreams, self-destruction, duels or unknown death sources disable it.",
  "awakened_claw.unit.native": "Native claw {index}: {status}",
  "awakened_claw.unit.bequest": "Claw received from Player {giver} on night {day}: {status}",
  "awakened_claw.status.ready": "Ready",
  "awakened_claw.status.spent": "Spent",
  "awakened_claw.status.transferred": "Transferred permanently",
  "awakened_claw.status.expired": "Expired",
  "awakened_claw.bequest": "Night {day}: bequeathed to Player {target}",
  "event.awakened_claw_bequeathed":
    "Night {day}: Player {actor} bequeathed one claw to Player {target}.",
  "event.awakened_claw_spent":
    "Day {day}: Player {actor} spent one claw targeting Player {target}; actual death resolves separately.",
  "event.awakened_claw_passed":
    "Day {day}: Player {actor} explicitly passed a shot and spent one claw.",
  "event.awakened_claws_expired": "Day {day}: Player {actor} had {count} remaining claws expire.",
  "replay.stage.awakened_claw_bequeathed": "Claw bequest (participants only)",
  "replay.stage.awakened_claw_spent": "Claw spent (owner only)",
  "replay.stage.awakened_claws_expired": "Claws expired (God only)",
};
export const messages = { definition, zhCN, en };
