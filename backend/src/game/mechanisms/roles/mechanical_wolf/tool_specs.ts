import type { MessageKey } from "@ai-werewolf-arena/game-text";
import type { ToolSpec } from "../../contracts";
import { MECHANICAL_TOOL_NAMES } from "./tool_names";

/** Shared transport descriptions remain neutral; current-turn hints carry localized full rules. */
export const MECHANICAL_TOOL_SPECS: ToolSpec[] = MECHANICAL_TOOL_NAMES.map((name) => {
  const parameters =
    name === "mechanical_mode"
      ? {
          type: "object",
          properties: { mode: { type: "string", enum: ["kill", "skill"] } },
          required: ["mode"],
          additionalProperties: false,
        }
      : {
          type: "object",
          properties: {
            target_id: {
              type:
                name === "mechanical_guard" || name === "mechanical_attack"
                  ? ["integer", "null"]
                  : "integer",
            },
          },
          required: ["target_id"],
          additionalProperties: false,
        };
  return {
    name,
    parameters: parameters,
    argHint:
      name === "mechanical_mode"
        ? 'mechanical_mode args: {"mode":"kill"|"skill"}'
        : `${name} args: {"target_id":number${name === "mechanical_guard" || name === "mechanical_attack" ? "|null" : ""}}`,
    userPromptHintKey: `action.${name}.hint` as MessageKey,
  };
});
