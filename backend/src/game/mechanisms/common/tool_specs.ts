/**
 * 负责跨角色通用工具的参数结构与提示资料；输入为固定工具定义，输出原有序规格数组。
 * 数组、规格及 parameters 保持可写，登记和首次 schema 解析由消费 registry／接收器负责。
 * 这里创建资料而不消费库存或提交动作；schema 与提示的存在不等于当前请求准入。
 */
import { ToolSpec } from "../contracts";

/** write_note → debate_vote → report_bug → speak → vote 的原公开顺序；const 不冻结数组或内层规格。 */
export const COMMON_TOOL_SPECS: ToolSpec[] = [
  {
    // 只声明 text 参数；墙、物品实例、作者和请求当前性仍由墙便条机制核验。
    name: "write_note",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
    argHint: 'write_note args: {"text":"..."}',
    userPromptHintKey: "action.write_note.hint",
  },
  {
    // support 的 null 是原可表达值，不能把结构接受等同于已获得辩论票权。
    name: "debate_vote",
    parameters: {
      type: "object",
      properties: { support: { type: ["boolean", "null"] } },
      required: ["support"],
      additionalProperties: false,
    },
    argHint: 'debate_vote args: {"support":true|false|null}',
    userPromptHintKey: "action.debate_vote.hint",
  },
  {
    // 类别／级别／文本描述报告形状；传输与接收入口另决定本次能否提交报告。
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
    // target_id 与 abstain 都是必填结构；两者语义关系和当前目标合法性仍需后续规则。
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
