/** 文件说明：定义跨角色通用工具的 schema 与提示信息。 */
import { ToolSpec } from "../contracts";
import { prop } from "../shared/schema";

/** 通用工具规格列表。 */
export const COMMON_TOOL_SPECS: ToolSpec[] = [
  {
    name: "report_bug",
    llm: {
      name: "report_bug",
      description:
        "上报已观察到的明确规则、状态、流程、日志或可见信息矛盾。可先上报再继续本轮正常行动；仅用于调试记录，不会改变对局状态。不要将正常的策略分歧、身份声称、诈身份或信息不足当作 bug。",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["flow", "rule", "state", "logging", "other"],
            description:
              "问题分类：flow=阶段、窗口、顺序或回合无法正常推进；rule=实际结果违反已声明规则；state=玩家存活、身份效果或公开/私有状态互相矛盾；logging=日志、复盘或上下文信息缺失、畸形或互相矛盾；other=其他可明确复现的运行异常。",
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
            description:
              "问题严重等级：low=不影响行动的展示或记录问题；medium=影响单个玩家或单个回合；high=可能改变规则、阶段或结算正确性；critical=流程无法继续或状态大范围损坏。",
          },
          message: prop(
            "string",
            "写清“观察到什么、按什么规则或状态本应如何、两者为何矛盾”；尽量包含玩家编号、阶段、事件或上下文。仅上报确定的异常，不上报正常的阵营判断、发言立场、诈身份或不确定推测。",
          ),
        },
        description: "调试上报参数；上报后仍应继续完成当前回合所需的正常行动。",
        required: ["category", "severity", "message"],
        additionalProperties: false,
      },
    },
    argHint:
      'report_bug args: {"category":"flow|rule|state|logging|other","severity":"low|medium|high|critical","message":"..."}',
    userPromptHint:
      "若你观察到明确的规则、状态、流程、日志或可见信息矛盾，可先调用 report_bug 上报，再继续本轮正常行动。请在 message 中说明观察到的现象、应有状态和矛盾原因；正常策略分歧、身份声称、诈身份或信息不足不是 bug。",
    gatewaySchema: {
      name: "report_bug",
      description: "上报已观察到的明确游戏逻辑或可见信息矛盾（仅调试记录，不改变对局状态）",
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
