/**
 * Owns Guard native slot access and ordered last-target writes.
 * Inputs are the role component and native state; outputs retain the ability owner's installation copy and selected read-only stored reference.
 * Its neutral data structure contains nullable last target and optional repeat policy.
 * Ordinary native and recipient last-target writes belong to this feature leaf;
 * callers retain effect/publication/use order and all captured permission checks.
 * Demon Hunter keeps its sealed third writer. There is no mirrored state,
 * resource refund, extra lease check or checkpoint shape change here.
 */
import type { GuardState, GuardReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";

import { findNightAbility, installNativeAbility } from "../abilities";

export function setGuardState(roleComp: RoleComponent, state: GuardState): GuardReadState {
  return installNativeAbility(roleComp, "guard", state);
}

export function getGuardState(
  roleComp: RoleComponent,
  abilityId?: string,
): GuardReadState | undefined {
  return findNightAbility(roleComp, "guard", abilityId)?.state;
}

/** The caller retains its original effect/publication and ability-use boundaries. */
export function recordGuardTarget(state: GuardReadState, targetId: EntityId | null): void {
  (state as { lastTarget: EntityId | null }).lastTarget = targetId;
}

/** Preserve captured LHS state before evaluating the original target ID getter. */
export function recordRecipientGuardTarget(
  ability: import("../abilities").NightAbilityReadView<"guard">,
  target: { readonly id: EntityId },
): void {
  const state = ability.state as { lastTarget: EntityId | null };
  state.lastTarget = target.id;
}
