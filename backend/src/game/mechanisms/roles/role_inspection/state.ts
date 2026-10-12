/**
 * Owns RoleInspection native state access and its ordered inspection history writes.
 * Inputs are an original role/ability or captured state, target, day and role label;
 * outputs preserve installation copying, selected slot identity and partial writes.
 * State data retains optional policies, nullable last target/day and role-label history.
 * Callers retain target/scope validation, use accounting and fact publication;
 * this owner adds no currentness recheck, resource refund, lifecycle or archive rule.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import type { InspectionResult } from "@ai-werewolf-arena/game-contract";
import { findNightAbility, installNativeAbility, type RoleInspectionPolicy } from "../abilities";

export interface RoleInspectionState {
  inspectionPolicy?: import("../../../../core/domain/board").InspectionPolicy;
  policy?: RoleInspectionPolicy;
  lastTarget: EntityId | null;
  lastDay: number | null;
  history: Array<{
    day: number;
    targetId: EntityId;
    result: Extract<InspectionResult, { kind: "role" }>;
  }>;
}

export function setRoleInspectionState(
  role: RoleComponent,
  state: RoleInspectionState,
): RoleInspectionState {
  return installNativeAbility(role, "role_check", state);
}

export function getRoleInspectionState(
  role: RoleComponent,
  abilityId?: string,
): RoleInspectionState | undefined {
  return findNightAbility(role, "role_check", abilityId)?.state;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordRoleInspection(
  state: RoleInspectionState,
  targetId: EntityId,
  day: number,
  result: Extract<InspectionResult, { kind: "role" }>,
): void {
  state.lastTarget = targetId;
  state.lastDay = day;
  state.history.push({ day, targetId, result: { ...result } });
}
