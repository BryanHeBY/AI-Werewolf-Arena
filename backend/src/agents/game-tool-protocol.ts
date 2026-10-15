/**
 * 为 SDK 与 MCP 生成同一游戏工具的 Zod 输入结构、描述和静态协议。
 * 输入为 locale；输出参数校验器及 JSON Schema，文案可变而工具名、字段和协议版本固定。
 * 本模块只校验工具包装结构，具体行动规则、回合开放状态和提交权限由运行端口确认。
 */
import { z } from "zod";
import type { ToolSchema } from "../adapters/llm/transport";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

/** 两种传输复用同一结构定义，避免参数 schema 与说明各自漂移。 */
export function gameToolProtocol(locale: Locale = "zh-CN") {
  const schemaError = text(locale, "error.schema_input");
  const inputs = {
    get_game_schema: z.object({}, { error: schemaError }),
    submit_action: z.object(
      {
        turn_id: z
          .string({ error: schemaError })
          .min(1, { error: schemaError })
          .describe(text(locale, "schema.turn_id")),
        action: z
          .string({ error: schemaError })
          .min(1, { error: schemaError })
          .describe(text(locale, "schema.action")),
        arguments: z
          .record(z.string({ error: schemaError }), z.unknown(), { error: schemaError })
          .describe(text(locale, "schema.arguments")),
      },
      { error: schemaError },
    ),
    report_bug: z.object(
      {
        turn_id: z
          .string({ error: schemaError })
          .min(1, { error: schemaError })
          .describe(text(locale, "schema.turn_id")),
        category: z
          .enum(["flow", "rule", "state", "logging", "other"], { error: schemaError })
          .describe(text(locale, "schema.category")),
        severity: z
          .enum(["low", "medium", "high", "critical"], { error: schemaError })
          .describe(text(locale, "schema.severity")),
        message: z
          .string({ error: schemaError })
          .min(1, { error: schemaError })
          .max(300, { error: schemaError })
          .describe(text(locale, "schema.report_message")),
      },
      { error: schemaError },
    ),
  };
  const schema = {
    protocol_version: "1",
    tools: {
      get_game_schema: text(locale, "schema.game.static_query"),
      submit_action: text(locale, "schema.game.static_submit"),
      report_bug: text(locale, "schema.game.static_report"),
    },
  };
  const descriptions = {
    get_game_schema: text(locale, "schema.game.query"),
    submit_action: text(locale, "schema.game.submit"),
    report_bug: text(locale, "schema.game.report"),
  };
  // 从同一 inputs 导出模型工具 schema；任意 arguments 仍需在行动网关按具体工具继续校验。
  const specs: ToolSchema[] = (Object.keys(inputs) as Array<keyof typeof inputs>).map((name) => ({
    name,
    description: descriptions[name],
    parameters: z.toJSONSchema(inputs[name], { io: "input", target: "draft-7" }) as Record<
      string,
      unknown
    >,
  }));
  return { inputs, descriptions, schema, specs };
}

// 默认语言出口保留既有消费契约；显式 locale 的调用方使用上方工厂。
const defaultProtocol = gameToolProtocol();
export const getGameSchemaInput = defaultProtocol.inputs.get_game_schema;
export const submitGameActionInput = defaultProtocol.inputs.submit_action;
export const reportGameBugInput = defaultProtocol.inputs.report_bug;
export type GameSubmitActionInput = z.infer<typeof submitGameActionInput>;
export type GameReportBugInput = z.infer<typeof reportGameBugInput>;
export const WEREWOLF_GAME_TOOL_SCHEMA = defaultProtocol.schema;
export const WEREWOLF_GAME_TOOL_SPECS = defaultProtocol.specs;
