/** 文件说明：定义跨角色通用工具的 schema 与提示信息。 */
import { ToolSpec } from "../contracts";

/** 通用工具规格列表。 */
export const COMMON_TOOL_SPECS: ToolSpec[] = [
  {
    name: "report_bug",
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
      additionalProperties: false,
    },
    argHint:
      'report_bug args: {"category":"flow|rule|state|logging|other","severity":"low|medium|high|critical","message":"..."}',
    userPromptHintKey: "action.report_bug.hint",
  },
  {
    name: "speak",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    argHint: 'speak args: {"text":"..."}',
  },
  {
    name: "vote",
    parameters: {
      type: "object",
      properties: {
        target_id: { type: ["number", "null"] },
        abstain: { type: "boolean" },
      },
      required: ["target_id", "abstain"],
      additionalProperties: false,
    },
    argHint: 'vote args: {"target_id":number|null,"abstain":true|false}',
  },
];
