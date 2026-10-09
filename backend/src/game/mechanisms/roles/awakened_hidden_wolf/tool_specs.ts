import type { MessageKey } from "@ai-werewolf-arena/game-text";
import type { ToolSpec } from "../../contracts";
import { AWAKENED_TOOL_NAMES } from "./tool_names";

export const AWAKENED_TOOL_SPECS: ToolSpec[] = AWAKENED_TOOL_NAMES.map((name) => {
  const nullable = name === "awakened_guard" || name === "awakened_attack";
  return {
    name,
    parameters: {
      type: "object",
      properties: { target_id: { type: nullable ? ["integer", "null"] : "integer" } },
      required: ["target_id"],
      additionalProperties: false,
    },
    argHint: `${name} args: {"target_id":number${nullable ? "|null" : ""}}`,
    userPromptHintKey: `action.${name}.hint` as MessageKey,
  };
});
