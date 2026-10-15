/**
 * 负责乌鸦规则、行动、阶段与事实的双语词典，输入为消息key及声明参数，输出固定模板。
 * 模板占位由catalog校验，不读取World、安装夜窗或修改票权；文案只描述政策与已发表事实。
 */
import type { MessageDefinition } from "../definition";
export const definition = {
  owner: "features/crow",
  parameters: {
    "prompt.config.crow": ["action", "ballot", "self"],
    "stage.crow_curse": [],
    "role.crow.brief": [],
    "role.crow.state": ["action", "ballot", "day", "self", "target"],
    "action.curse_exile.hint": [],
    "action.curse_exile.directive": [],
    "event.crow_curse_chosen": ["actor", "day", "target"],
    "event.crow_curse_applied": ["day", "round", "target"],
    "crow.ballot.first": [],
    "crow.ballot.all": [],
    "crow.action.optional": [],
    "crow.action.required": [],
    "crow.self.allowed": [],
    "crow.self.forbidden": [],
    "crow.pass": [],
    "replay.stage.crow_curse_chosen": [],
    "replay.stage.crow_curse_applied": [],
  },
} as const satisfies MessageDefinition;
export const zhCN = {
  "prompt.config.crow":
    "乌鸦政策：{ballot}；{action}；{self}。夜选秘密，实际附加票公开但不暴露乌鸦座位。",
  "stage.crow_curse": "乌鸦诅咒",
  "role.crow.brief":
    "乌鸦：每夜秘密诅咒一名存活玩家，次日放逐额外被计一票。不能连续两夜选择同一目标；不影响警长票或狼刀。",
  "role.crow.state": "当前规则：{ballot}；{action}；{self}。最近选择：第{day}夜，目标{target}。",
  "action.curse_exile.hint":
    "target_id 必须来自本轮 crow_candidates；仅规则允许或无合法目标时可用 null 明确放弃。",
  "action.curse_exile.directive":
    "秘密选择本夜诅咒目标，遵守连续夜、自选与必选政策，仅调用 curse_exile 提交。",
  "event.crow_curse_chosen": "{actor}号乌鸦第{day}夜诅咒选择：{target}。",
  "event.crow_curse_applied": "第{day}天第{round}轮放逐计票：{target}号受到乌鸦诅咒，额外计1票。",
  "crow.ballot.first": "仅首轮放逐加一票",
  "crow.ballot.all": "每轮放逐各加一票",
  "crow.action.optional": "允许明确放弃",
  "crow.action.required": "有合法目标时必须选择",
  "crow.self.allowed": "允许自选",
  "crow.self.forbidden": "禁止自选",
  "crow.pass": "未选择",
  "replay.stage.crow_curse_chosen": "乌鸦秘密选择",
  "replay.stage.crow_curse_applied": "乌鸦附加票",
} as const;
export const en = {
  "prompt.config.crow":
    "Crow policy: {ballot}; {action}; {self}. Night choices are private; extra votes are public without revealing the Crow seat.",
  "stage.crow_curse": "Crow curse",
  "role.crow.brief":
    "Crow: secretly curse one living player each night to add one exile vote against them the next day. You cannot curse the same player on consecutive nights. Sheriff and pack votes are unaffected.",
  "role.crow.state":
    "Current rules: {ballot}; {action}; {self}. Latest choice: night {day}, target {target}.",
  "action.curse_exile.hint":
    "target_id must be in this turn's crow_candidates; null explicitly passes only when permitted or no legal target exists.",
  "action.curse_exile.directive":
    "Secretly choose tonight's curse target, respecting consecutive-night, self-target and required-choice policies. Submit using curse_exile only.",
  "event.crow_curse_chosen": "Crow {actor}, night {day} curse choice: {target}.",
  "event.crow_curse_applied":
    "Day {day}, exile ballot {round}: player {target} receives one extra vote from the Crow curse.",
  "crow.ballot.first": "add one vote only to the initial exile ballot",
  "crow.ballot.all": "add one vote to each exile ballot",
  "crow.action.optional": "explicit passing allowed",
  "crow.action.required": "a choice is required when a legal target exists",
  "crow.self.allowed": "self-targeting allowed",
  "crow.self.forbidden": "self-targeting forbidden",
  "crow.pass": "no choice",
  "replay.stage.crow_curse_chosen": "Crow secret choice",
  "replay.stage.crow_curse_applied": "Crow extra vote",
} satisfies Record<keyof typeof definition.parameters, string>;
export const messages = { definition, zhCN, en };
