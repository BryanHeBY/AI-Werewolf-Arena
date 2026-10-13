/**
 * Owns Wolf Beauty's existing private-state slot and ordinary charm history writes.
 * Inputs are the original role or captured state plus the accepted nullable target/day;
 * outputs retain the same stored reference, assignment order and partial writes.
 * State data retains death-link policy, nullable target/day and nullable-target history.
 * Callers own target qualification, charm binding and public/private publication;
 * this owner never repeats those checks, refunds effects or changes death policy.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type { WolfBeautyState, WolfBeautyReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";

export function setWolfBeautyState(
  roleComp: RoleComponent,
  state: WolfBeautyState,
): WolfBeautyReadState {
  (roleComp.privateState as { wolf_beauty: WolfBeautyState })["wolf_beauty"] = state;
  return state;
}

export function getWolfBeautyState(roleComp: RoleComponent): WolfBeautyReadState | undefined {
  return (roleComp.privateState as { readonly wolf_beauty?: unknown })["wolf_beauty"] as
    WolfBeautyReadState | undefined;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordCharmSelection(
  state: WolfBeautyReadState,
  targetId: EntityId | null,
  day: number,
): void {
  (state as { targetId: EntityId | null }).targetId = targetId;
  (state as { lastActedDay: number | null }).lastActedDay = day;
  (state.history as WolfBeautyState["history"]).push({ day, targetId });
}
