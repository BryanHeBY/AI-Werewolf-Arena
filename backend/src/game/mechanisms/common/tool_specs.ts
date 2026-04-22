/** 文件说明：定义跨角色通用工具的 schema 与提示信息。 */
import { ToolSpec } from "../contracts";
import { prop } from "../shared/schema";

/** 通用工具规格列表。 */
export const COMMON_TOOL_SPECS: ToolSpec[] = [
  {
    name: "report_bug",
    llm: {
      name: "report_bug",
      description: "上报疑似游戏逻辑问题（仅用于调试记录，不会改变对局状态）。",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["flow", "rule", "state", "logging", "other"],
            description: "问题分类。",
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description: "问题严重等级。",
          },
          message: prop("string", "问题描述，建议包含具体异常现象。"),
        },
        description: "调试上报参数。",
        required: ["category", "severity", "message"],
        additionalProperties: false,
      },
    },
    argHint:
      'report_bug args: {"category":"flow|rule|state|logging|other","severity":"low|medium|high|critical","message":"..."}',
    gatewaySchema: {
      name: "report_bug",
      description: "上报疑似游戏逻辑问题",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["flow", "rule", "state", "logging", "other"],
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
          message: { type: "string" },
        },
        required: ["category", "severity", "message"],
      },
    },
  },
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
