import { ToolSpec } from "../contracts";
import { prop } from "../shared/schema";

export const COMMON_TOOL_SPECS: ToolSpec[] = [
  {
    name: "speak",
    llm: {
      name: "speak",
      description: "发送发言文本。",
      parameters: {
        type: "object",
        properties: {
          text: prop("string", "公开发言内容。"),
        },
        description: "白天公开发言参数。",
        required: ["text"],
        additionalProperties: false,
      },
    },
    argHint: 'speak args: {"text":"..."}',
  },
  {
    name: "vote",
    llm: {
      name: "vote",
      description: "白天放逐投票。abstain=true 表示本轮弃票。",
      parameters: {
        type: "object",
        properties: {
          target_id: prop(["number", "null"], "放逐目标玩家编号；弃票时必须为 null。"),
          abstain: prop("boolean", "是否弃票；true 时本票不参与放逐计票。"),
        },
        description: "白天放逐投票参数。",
        required: ["target_id", "abstain"],
        additionalProperties: false,
      },
    },
    argHint: 'vote args: {"target_id":number|null,"abstain":true|false}',
  },
];
