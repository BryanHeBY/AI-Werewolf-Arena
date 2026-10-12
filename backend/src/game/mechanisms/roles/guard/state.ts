/**
 * Owns Guard state data and access to its existing ability instance slot.
 * Inputs are the role component and native state; outputs retain the ability owner's installation copy and selected stored reference.
 * Ordinary native and recipient last-target writes belong to this feature leaf;
 * callers retain effect/publication/use order and all captured permission checks.
 * Demon Hunter keeps its sealed third writer. There is no mirrored state,
 * resource refund, extra lease check or checkpoint shape change here.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";
import type { GuardRepeatPolicy } from "@ai-werewolf-arena/game-contract";
import { findNightAbility, installNativeAbility } from "../abilities";

export interface GuardState {
  readonly lastTarget: EntityId | null;
  repeatPolicy?: GuardRepeatPolicy;
}

export function setGuardState(roleComp: RoleComponent, state: GuardState): GuardState {
  return installNativeAbility(roleComp, "guard", state);
}

export function getGuardState(roleComp: RoleComponent, abilityId?: string): GuardState | undefined {
  return findNightAbility(roleComp, "guard", abilityId)?.state;
}

/** The caller retains its original effect/publication and ability-use boundaries. */
export function recordGuardTarget(state: GuardState, targetId: EntityId | null): void {
  (state as { lastTarget: EntityId | null }).lastTarget = targetId;
}

/** Preserve captured LHS state before evaluating the original target ID getter. */
export function recordRecipientGuardTarget(
  ability: import("../abilities").NightAbility<"guard">,
  target: { readonly id: EntityId },
): void {
  const state = ability.state as { lastTarget: EntityId | null };
  state.lastTarget = target.id;
}
