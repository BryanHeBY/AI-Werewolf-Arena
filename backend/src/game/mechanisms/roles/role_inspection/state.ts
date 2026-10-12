/**
 * Owns RoleInspection state data and access to its existing ability instance slot.
 * Inputs are the role component and native state; outputs retain the ability owner's installation copy and selected stored reference.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
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
