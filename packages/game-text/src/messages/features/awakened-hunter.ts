/**
 * 负责觉醒猎人的方向、一次付款与实际巡猎结果的双语模板。输入稳定键和惰性参数，输出自然文案。
 * 付款、提案和真实死亡分别表述；不读取World、推断受众或翻译玩家原文。
 */
import type { MessageDefinition } from "../definition";
export const definition = {
  owner: "features/awakened-hunter",
  parameters: {
    "role.awakened_hunter.brief": [],
    "role.awakened_hunter.state": ["payment", "resource"],
    "awakened_patrol.payment": ["day", "direction", "root", "target"],
    "awakened_patrol.pass": ["day"],
    "awakened_patrol.direction.clockwise": [],
    "awakened_patrol.direction.counter_clockwise": [],
    "action.patrol.hint": [],
    "action.patrol.directive": [],
    "stage.awakened_patrol": [],
    "request.summary.awakened_patrol": [],
    "prompt.config.awakened_hunter": [],
    "prompt.stage.patrol_seat_order": ["ids"],
    "event.awakened_patrol_paid": ["actor", "day", "direction", "root", "target"],
    "event.awakened_patrol_passed": ["actor", "day"],
    "event.awakened_patrol_resolved": ["actor", "day", "direction", "target"],
    "event.awakened_patrol_no_death": ["actor", "day", "direction"],
    "replay.stage.awakened_patrol_paid": [],
    "replay.stage.awakened_patrol_resolved": [],
    "death.awakened_patrol": [],
  },
} as const satisfies MessageDefinition;
export const zhCN = {
  "role.awakened_hunter.brief":
    "觉醒猎人属于好人神职，真实出局后可消费唯一巡猎单位，选择正序或逆序命中该方向最近的当前活狼，也可null明确放弃。毒死仍可巡猎；不使用普通shoot或自选目标。夜根巡猎禁本次目标特殊狼替死，白天根不禁；方向不向你提前暴露命中座位。",
  "role.awakened_hunter.state": "巡猎资源：{resource}。已付记录：{payment}。",
  "awakened_patrol.payment":
    "第{day}天，方向{direction}，原命中{target}号，死亡根为{root}；实际结算另看公开事实",
  "awakened_patrol.pass": "第{day}天明确放弃巡猎，单位已消费",
  "awakened_patrol.direction.clockwise": "正序（沿所示座位环前进）",
  "awakened_patrol.direction.counter_clockwise": "逆序（沿所示座位环后退）",
  "action.patrol.hint":
    "direction只能clockwise、counter_clockwise或null。按已给实际座位环选方向；不能填写target_id或提前索要狼位。null也消费唯一单位。",
  "action.patrol.directive":
    "只用patrol在原死亡许可内提交方向或明确放弃；缺失、迟到或撤权不等于放弃，不得假报实际命中。",
  "stage.awakened_patrol": "觉醒猎人巡猎",
  "request.summary.awakened_patrol": "按原座位环选择巡猎方向或明确放弃",
  "prompt.config.awakened_hunter":
    "本板采用AWA方向巡猎：真实死亡后按冻结座位环跳过死人，取方向上第一名当前活狼；毒不禁巡猎。夜根巡猎禁目标本次替死，日根不禁；普通守卫／解药不挡巡猎。先处理实际死亡完整链后才判胜，不根据提案提前改存活。",
  "prompt.stage.patrol_seat_order":
    "本局原座位环：{ids}。正序按箭头前进，逆序后退并回绕；这是座位顺序，不是狼位名单。",
  "event.awakened_patrol_paid":
    "第{day}天，{actor}号已消费唯一巡猎，方向{direction}，原命中{target}号，根阶段{root}；实际死亡尚待结算。",
  "event.awakened_patrol_passed": "第{day}天，{actor}号明确放弃巡猎，唯一单位已消费。",
  "event.awakened_patrol_resolved": "第{day}天，{actor}号按{direction}巡猎，{target}号实际出局。",
  "event.awakened_patrol_no_death": "第{day}天，{actor}号按{direction}巡猎，本次没有实际出局者。",
  "replay.stage.awakened_patrol_paid": "巡猎付款（仅本人）",
  "replay.stage.awakened_patrol_resolved": "公开巡猎结果",
  "death.awakened_patrol": "觉醒猎人巡猎",
} as const;
export const en = {
  "role.awakened_hunter.brief":
    "The Awakened Hunter is a good power role. After actual death, spend one patrol to select clockwise or counter-clockwise and reach the nearest currently living wolf in that direction, or null to pass. Poison does not disable patrol. Do not use ordinary shoot or select a target. Night-origin patrol suppresses the target wolf’s replacement for that proposal; day-origin patrol does not. No hit seat is revealed before your choice.",
  "role.awakened_hunter.state": "Patrol resource: {resource}. Committed payment: {payment}.",
  "awakened_patrol.payment":
    "Day {day}: direction {direction}, original hit Player {target}, death origin {root}; see public facts for actual resolution",
  "awakened_patrol.pass": "Day {day}: explicitly passed patrol; the unit was spent",
  "awakened_patrol.direction.clockwise": "clockwise (forward along the displayed seat ring)",
  "awakened_patrol.direction.counter_clockwise":
    "counter-clockwise (backward along the displayed seat ring)",
  "action.patrol.hint":
    "direction must be clockwise, counter_clockwise or null. Choose along the supplied actual seat ring; do not provide target_id or request wolf seats. Null also spends the only unit.",
  "action.patrol.directive":
    "Use patrol under the original death permit to choose a direction or explicitly pass. Missing, late or revoked responses are not passes; do not invent an actual hit.",
  "stage.awakened_patrol": "Awakened patrol",
  "request.summary.awakened_patrol":
    "Choose a patrol direction along the original seat ring or explicitly pass",
  "prompt.config.awakened_hunter":
    "This board uses AWA directional patrol: after actual death, follow the frozen seat ring, skip dead players and reach the nearest currently living wolf. Poison permits patrol. A night-origin patrol suppresses that target’s replacement; a day-origin patrol does not. Ordinary guard and antidote do not block patrol. Resolve the complete real death chain before victory, and never infer life changes from a proposal.",
  "prompt.stage.patrol_seat_order":
    "Original seat ring: {ids}. Clockwise follows the arrows; counter-clockwise goes backward and wraps. This is seat order, not a wolf candidate list.",
  "event.awakened_patrol_paid":
    "Day {day}: Player {actor} spent the only patrol, direction {direction}, original hit Player {target}, root phase {root}; actual death still requires resolution.",
  "event.awakened_patrol_passed":
    "Day {day}: Player {actor} explicitly passed patrol; the only unit was spent.",
  "event.awakened_patrol_resolved":
    "Day {day}: Player {actor} patrolled {direction}; Player {target} actually died.",
  "event.awakened_patrol_no_death":
    "Day {day}: Player {actor} patrolled {direction}; no player actually died from it.",
  "replay.stage.awakened_patrol_paid": "Patrol payment (owner only)",
  "replay.stage.awakened_patrol_resolved": "Public patrol result",
  "death.awakened_patrol": "Awakened Hunter patrol",
};
export const messages = { definition, zhCN, en };
