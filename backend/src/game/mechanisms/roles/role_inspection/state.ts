/**
 * Owns RoleInspection native state access and its ordered inspection history writes.
 * Inputs are an original role/ability or captured state, target, day and role label;
 * outputs preserve installation copying, selected slot identity and partial writes.
 * Neutral payload/read structures come from the contract package; this leaf retains the live slot and ordered role-label history writes.
 * Callers retain target/scope validation, use accounting and fact publication;
 * this owner adds no currentness recheck, resource refund, lifecycle or archive rule.
 */
import type {
  RoleInspectionState,
  RoleInspectionReadState,
} from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import type { InspectionResult } from "@ai-werewolf-arena/game-contract";
import { findNightAbility, installNativeAbility } from "../abilities";

export function setRoleInspectionState(
  role: RoleComponent,
  state: RoleInspectionState,
): RoleInspectionReadState {
  return installNativeAbility(role, "role_check", state);
}

export function getRoleInspectionState(
  role: RoleComponent,
  abilityId?: string,
): RoleInspectionReadState | undefined {
  return findNightAbility(role, "role_check", abilityId)?.state;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordRoleInspection(
  state: RoleInspectionReadState,
  targetId: EntityId,
  day: number,
  result: Extract<InspectionResult, { kind: "role" }>,
): void {
  (state as RoleInspectionState).lastTarget = targetId;
  (state as RoleInspectionState).lastDay = day;
  (state as RoleInspectionState).history.push({ day, targetId, result: { ...result } });
}

/** Preserve Pure White's three original state reads and exactly one result-history append. */
export function recordAbilityRoleInspection(
  ability: import("../abilities").NightAbilityReadView<"role_check">,
  targetId: EntityId,
  day: number,
  result: Extract<InspectionResult, { kind: "role" }>,
): void {
  (ability.state as RoleInspectionState).lastTarget = targetId;
  (ability.state as RoleInspectionState).lastDay = day;
  (ability.state as RoleInspectionState).history.push({ day, targetId, result: { ...result } });
}
