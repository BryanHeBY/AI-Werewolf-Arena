import type { ToolName } from "../../../../core/domain/model";

/** Static metadata has no runtime role-state dependency. */
export const MECHANICAL_TOOL_NAMES = [
  "mimic_role",
  "mechanical_mode",
  "mechanical_inspect",
  "mechanical_poison",
  "mechanical_guard",
  "mechanical_attack",
] as const satisfies readonly ToolName[];
