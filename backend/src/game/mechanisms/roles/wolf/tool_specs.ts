/** 文件说明：狼人工具规格与阶段提示规则定义。 */
import { StageDirectiveRule, ToolSpec } from "../../contracts";
import { prop } from "../../shared/schema";

const selfDestructSchema = {
  name: "self_destruct",
  description: "自爆需谨慎！！！狼人可在允许窗口自爆，中断流程并跳夜",
  parameters: {
    type: "object",
    properties: {
      reason: { type: "string" },
      confirm: { type: "boolean" },
    },
    required: ["reason", "confirm"],
  },
} as const;

/** 狼人工具规格列表。 */
export const WOLF_TOOL_SPECS: ToolSpec[] = [
  {
    name: "speak_to_wolves",
    llm: {
      name: "speak_to_wolves",
      description: "狼人夜聊发言；end_chat=true 表示发言后结束本人后续夜聊轮次。",
      parameters: {
        type: "object",
        properties: {
          text: prop("string", "狼人夜聊发言内容。"),
          end_chat: prop("boolean", "是否在本次发言后结束本人后续夜聊轮次。"),
        },
        description: "狼人夜聊发言参数。",
        required: ["text", "end_chat"],
        additionalProperties: false,
      },
    },
    argHint: 'speak_to_wolves args: {"text":"...","end_chat":true|false}',
    userPromptHint: "若使用 speak_to_wolves，end_chat=true 表示结束整晚夜聊。",
  },
  {
    name: "kill_vote",
    llm: {
      name: "kill_vote",
      description: "狼人刀人投票。abstain=true 表示本狼人本轮弃刀（不提交目标）。",
      parameters: {
        type: "object",
        properties: {
          target_id: prop(["number", "null"], "刀人目标玩家编号；弃刀时必须为 null。"),
          abstain: prop("boolean", "是否弃刀；true 时不提交目标且本票不计入刀人结算。"),
        },
        description: "狼人刀人投票参数。",
        required: ["target_id", "abstain"],
        additionalProperties: false,
      },
    },
    argHint: 'kill_vote args: {"target_id":number|null,"abstain":true|false}',
  },
  {
    name: "self_destruct",
    llm: {
      name: "self_destruct",
      description: "自爆需谨慎！！！狼人执行自爆（高风险低频动作）。",
      parameters: {
        type: "object",
        properties: {
          reason: prop("string", "自爆原因说明，仅用于日志与策略记录。"),
          confirm: prop("boolean", "确认执行自爆。仅当 confirm=true 时才会通过校验。"),
        },
        description: "狼人自爆参数。",
        required: ["reason", "confirm"],
        additionalProperties: false,
      },
    },
    argHint: 'self_destruct args: {"reason":"...","confirm":true}',
    gatewaySchema: selfDestructSchema,
  },
];

/** 狼人阶段提示规则。 */
export const WOLF_STAGE_DIRECTIVES: StageDirectiveRule[] = [
  {
    match: (allowedTools) => allowedTools.includes("speak_to_wolves"),
    text: "当前是【狼人交流阶段】：只能调用 speak_to_wolves。若你想结束后续夜聊，请在该工具中设置 end_chat=true；本阶段不会完成刀人。",
  },
  {
    match: (allowedTools) => allowedTools.length === 1 && allowedTools[0] === "kill_vote",
    text: "当前是【狼人刀人投票阶段】：必须调用 kill_vote；若本轮决定不刀，请设置 abstain=true 且 target_id=null。",
  },
  {
    match: (allowedTools) => allowedTools.length === 1 && allowedTools[0] === "self_destruct",
    text: "自爆需谨慎！！！当前是【狼人自爆窗口】：self_destruct 是唯一会改变局面的动作，仅在局势极端不利时使用，且必须携带 confirm=true 才会生效。",
  },
];
