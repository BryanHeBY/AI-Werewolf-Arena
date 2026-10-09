import type { ToolName } from "../../../../core/domain/model";

/** Static metadata has no runtime role-state dependency. */
export const AWAKENED_TOOL_NAMES = [
  "awakened_mimic",
  "awakened_poison",
  "awakened_guard",
  "awakened_attack",
] as const satisfies readonly ToolName[];
