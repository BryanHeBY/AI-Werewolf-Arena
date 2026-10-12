/**
 * Owns WolfBeauty state data and access to its existing private-state slot.
 * Inputs are the role component and native state; outputs retain the exact stored object, including assignment-before-return behavior.
 * Existing mutation commands, lifecycle validation, player projection and checkpoint
 * encoding keep their current responsibilities. This leaf creates no mirror state,
 * consumes no resource and does not decide whether a request is authorized.
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
  roleComp.privateState["wolf_beauty"] = state as unknown;
  return state;
}

export function getWolfBeautyState(roleComp: RoleComponent): WolfBeautyState | undefined {
  return roleComp.privateState["wolf_beauty"] as WolfBeautyState | undefined;
}
