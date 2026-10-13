/**
 * Owns Wolf Beauty's existing private-state slot and ordinary charm history writes.
 * Inputs are the original role or captured state plus the accepted nullable target/day;
 * outputs retain the same stored reference, assignment order and partial writes.
 * State data retains death-link policy, nullable target/day and nullable-target history.
 * Callers own target qualification, charm binding and public/private publication;
 * this owner never repeats those checks, refunds effects or changes death policy.
 */
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";

export interface WolfBeautyState {
  deathLinkPolicy?: import("../../../../core/domain/board").BeautyDeathLinkPolicy;
  targetId: EntityId | null;
  lastActedDay: number | null;
  history: Array<{ day: number; targetId: EntityId | null }>;
}

export function setWolfBeautyState(
  roleComp: RoleComponent,
  state: WolfBeautyState,
): WolfBeautyState {
  (roleComp.privateState as { wolf_beauty: WolfBeautyState })["wolf_beauty"] = state;
  return state;
}

export function getWolfBeautyState(roleComp: RoleComponent): WolfBeautyState | undefined {
  return roleComp.privateState["wolf_beauty"] as WolfBeautyState | undefined;
}

/** The caller retains every preflight and subsequent use/effect/publication operation. */
export function recordCharmSelection(
  state: WolfBeautyState,
  targetId: EntityId | null,
  day: number,
): void {
  state.targetId = targetId;
  state.lastActedDay = day;
  state.history.push({ day, targetId });
}
