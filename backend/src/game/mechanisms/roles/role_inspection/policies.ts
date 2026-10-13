/**
 * Owns configured role-inspection policy defaults, schema and displayed policy text.
 * Inputs are read-only instance policy fields, board configuration and locale;
 * outputs are repeat/required decisions, parsed configuration and translated labels.
 * These queries never write the live inspection payload or authorize an action.
 */
import { z } from "zod";
import {
  INSPECTION_POLICIES,
  type BoardConfig,
  type InspectionPolicy,
} from "../../../../core/domain/board";
import { roleInspectionPolicy } from "../abilities";
import type { RoleInspectionReadState } from "../private_state";
import type { RoleProfile } from "../contracts";
import { text, type Locale } from "@ai-werewolf-arena/game-text";

export const DEFAULT_INSPECTION_POLICIES = {
  gargoyle: "awa_unique_required_v1",
  psychic: "awa_repeat_optional_v1",
  mirror: "awa_unique_optional_v1",
  pure_white: "awa_repeat_optional_v1",
  wolf_witch: "awa_repeat_optional_v1",
} as const;
/** Instance identity controls scheduling. Configured target/action policy never changes it. */
export function inspectionPolicy(
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
): InspectionPolicy {
  const value =
    state.inspectionPolicy ??
    DEFAULT_INSPECTION_POLICIES[roleInspectionPolicy(state as RoleInspectionReadState)];
  if (!INSPECTION_POLICIES.includes(value))
    throw new Error("role_inspection_configuration_policy_invalid");
  return value;
}
export const inspectionRepeats = (
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
) => inspectionPolicy(state) === "awa_repeat_optional_v1";
export const inspectionRequired = (
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
) => inspectionPolicy(state) === "awa_unique_required_v1";
export function renderInspectionPolicy(
  state: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy">,
  locale: Locale,
): string {
  return text(
    locale,
    inspectionPolicy(state) === "awa_repeat_optional_v1"
      ? "role.inspection.repeat_optional"
      : inspectionPolicy(state) === "awa_unique_required_v1"
        ? "role.inspection.unique_required"
        : "role.inspection.unique_optional",
  );
}
export function inspectionConfiguration(
  key: "gargoyle" | "psychic" | "mirrorGirl",
  defaultValue: InspectionPolicy,
): NonNullable<RoleProfile["configuration"]> {
  const schema = z.strictObject({
    inspectionPolicy: z.enum(INSPECTION_POLICIES).default(defaultValue),
  });
  return {
    schema,
    defaults: schema.parse({}),
    apply: (config, value) => ({ ...config, [key]: schema.parse(value) }),
    serialize: (config: BoardConfig) => schema.parse(config[key] ?? {}),
  };
}
