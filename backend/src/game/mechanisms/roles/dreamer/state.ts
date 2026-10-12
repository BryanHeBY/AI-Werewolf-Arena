/**
 * Owns Dreamer native state access and its ordered target/day/history writes.
 * Inputs are the original role/ability or captured state and accepted selection;
 * outputs preserve installation copying, selected slot identity and partial writes.
 * State data retains optional protection policy, nullable last target/day and history.
 * Consecutive-target calculation, leases, use counts, dream effects and publication
 * remain at their original caller positions; this owner creates no mirror or refund.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import { findNightAbility, installNativeAbility } from "../abilities";

export interface DreamerState {
  protectionPolicy?: import("../../../../core/domain/board").DreamProtectionPolicy;
  lastTarget: EntityId | null;
  lastDay: number | null;
  history: Array<{ day: number; targetId: EntityId }>;
}

export function setDreamerState(roleComp: RoleComponent, state: DreamerState): DreamerState {
  return installNativeAbility(roleComp, "dream", state);
}

export function getDreamerState(
  roleComp: RoleComponent,
  abilityId?: string,
): DreamerState | undefined {
  return findNightAbility(roleComp, "dream", abilityId)?.state;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordDreamSelection(state: DreamerState, targetId: EntityId, day: number): void {
  state.lastTarget = targetId;
  state.lastDay = day;
  state.history.push({ day, targetId });
}
