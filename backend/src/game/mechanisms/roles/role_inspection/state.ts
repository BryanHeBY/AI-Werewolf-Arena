/**
 * Owns RoleInspection native state access and its ordered inspection history writes.
 * Inputs are an original role/ability or captured state, target, day and role label;
 * outputs preserve installation copying, selected slot identity and partial writes.
 * The read-only state data structure retains optional policies, nullable last target/day and role-label history.
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

/** Existing role-label result rows are readonly without copying the runtime slot. */
export type RoleInspectionReadState = Readonly<Omit<RoleInspectionState, "history">> & {
  readonly history: readonly (Readonly<Omit<RoleInspectionState["history"][number], "result">> & {
    readonly result: Readonly<RoleInspectionState["history"][number]["result"]>;
  })[];
};

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
