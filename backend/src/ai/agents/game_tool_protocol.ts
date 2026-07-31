import { z } from "zod";
import { ToolSchema } from "../integrations/llm/ai_sdk_client";

export const getGameSchemaInput = z.object({});
export const submitGameActionInput = z.object({
  turn_id: z.string().min(1),
  action: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()),
});
export const reportGameBugInput = z.object({
  turn_id: z.string().min(1),
  category: z.enum(["flow", "rule", "state", "logging", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  message: z.string().min(1).max(300),
});

export type GameSubmitActionInput = z.infer<typeof submitGameActionInput>;
export type GameReportBugInput = z.infer<typeof reportGameBugInput>;

export const WEREWOLF_GAME_TOOL_SCHEMA = {
  protocol_version: "1",
  tools: {
    get_game_schema: "{}；查询固定工具协议，不返回局内状态。",
    submit_action: "{ turn_id, action, arguments }；提交当前回合唯一会生效的行动。",
    report_bug: "{ turn_id, category, severity, message }；上报明确的引擎矛盾。",
  },
} as const;

function parameters(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

/** SDK function-tools 与 ACP MCP 共同使用的玩家工具契约。 */
export const WEREWOLF_GAME_TOOL_SPECS: ToolSchema[] = [
  {
    name: "get_game_schema",
    description: "查询固定的狼人杀工具协议；不返回局内状态。",
    parameters: parameters(getGameSchemaInput),
  },
  {
    name: "submit_action",
    description: "提交当前回合唯一会生效的游戏行动；普通文本不会产生游戏效果。",
    parameters: parameters(submitGameActionInput),
  },
  {
    name: "report_bug",
    description: "上报明确的规则、流程、状态、日志或可见性矛盾；不替代必须行动。",
    parameters: parameters(reportGameBugInput),
  },
];

