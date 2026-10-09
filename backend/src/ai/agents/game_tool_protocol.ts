import { z } from "zod";
import type { ToolSchema } from "../integrations/llm/transport";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

/** SDK and MCP derive the same descriptions, parameter schemas and static protocol. */
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

// Compatibility exports retain the original default language and machine contracts.
const defaultProtocol = gameToolProtocol();
export const getGameSchemaInput = defaultProtocol.inputs.get_game_schema;
export const submitGameActionInput = defaultProtocol.inputs.submit_action;
export const reportGameBugInput = defaultProtocol.inputs.report_bug;
export type GameSubmitActionInput = z.infer<typeof submitGameActionInput>;
export type GameReportBugInput = z.infer<typeof reportGameBugInput>;
export const WEREWOLF_GAME_TOOL_SCHEMA = defaultProtocol.schema;
export const WEREWOLF_GAME_TOOL_SPECS = defaultProtocol.specs;
