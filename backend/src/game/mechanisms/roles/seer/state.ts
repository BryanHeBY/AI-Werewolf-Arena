/**
 * Owns Seer access to the existing ability-state slot and ordinary inspection writes.
 * Inputs are a role's selected ability or an already captured state reference;
 * outputs are the original stored state data and its ordered last-result/history writes.
 * The ability owner retains installation copying, instance identity, retirement
 * and use counts. This module never rechecks a lease, changes phase or rolls back
 * partial writes; Demon Hunter's sealed native commit remains a separate writer.
 * Read/install outputs grant deeply readonly live views. These trusted commit
 * commands alone restore mutable access locally, preserving each original getter
 * and partial-write prefix; the view itself never grants action authorization.
 */
import type { EntityId, InspectionResult } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { findNightAbility, installNativeAbility, type NightAbilityReadView } from "../abilities";
import type { SeerState, SeerReadState } from "./state-contracts";

/** Installation retains the ability owner's input copy and returned owned reference. */
export function setSeerState(roleComp: RoleComponent, state: SeerState): SeerReadState {
  return installNativeAbility(roleComp, "seer_check", state);
}

/** Reads retain native-first selection and do not filter inactive or spent instances. */
export function getSeerState(
  roleComp: RoleComponent,
  abilityId?: string,
): SeerReadState | undefined {
  return findNightAbility(roleComp, "seer_check", abilityId)?.state;
}

/** The caller owns target/scope checks and all effects before and after this write prefix. */
export function recordSeerInspection(
  state: SeerReadState,
  targetId: EntityId,
  isWerewolf: boolean,
  inspection: InspectionResult,
): void {
  (state as SeerState).lastTarget = targetId;
  (state as SeerState).lastIsWerewolf = isWerewolf;
  (state as SeerState).lastResult = { ...inspection };
  (state as SeerState).history.push({ targetId, isWerewolf, result: { ...inspection } });
}

/** Recipient reads retain their original per-write ability state and target ID accesses. */
export function recordRecipientSeerInspection(
  ability: NightAbilityReadView<"seer_check">,
  target: { readonly id: EntityId },
  isWerewolf: boolean,
  result: InspectionResult,
): void {
  (ability.state as SeerState).lastTarget = target.id;
  (ability.state as SeerState).lastIsWerewolf = isWerewolf;
  (ability.state as SeerState).lastResult = { ...result };
  (ability.state as SeerState).history.push({
    targetId: target.id,
    isWerewolf,
    result: { ...result },
  });
}
