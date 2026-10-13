/**
 * Owns Miracle Merchant's copied trade-state data slot and its existing public projection.
 * Inputs are the original role/state and night day; outputs retain choice fields,
 * stock and wait eligibility. This owner restores only miracle_merchant at the
 * original assignment, preserving installation copy and field failure order.
 * No generic private-state writer, fresh inventory or turn permission is created.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type {
  MiracleSkill,
  MerchantState,
  MerchantReadState,
} from "@ai-werewolf-arena/game-contract";

import type { PlayerMerchantState } from "../player_extended_state";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { copyAbilityData } from "../abilities";

export const freshMerchantState = (): MerchantState => ({
  remaining: 1,
  closedDay: null,
  choice: null,
});
export function getMerchantState(role: RoleComponent | undefined): MerchantReadState | undefined {
  return role?.privateState.miracle_merchant as MerchantReadState | undefined;
}
export function setMerchantState(role: RoleComponent, state: MerchantState): void {
  (role.privateState as { miracle_merchant: MerchantState }).miracle_merchant =
    copyAbilityData(state);
}
export function projectMerchantState(state: MerchantReadState): PlayerMerchantState {
  return {
    remaining: state.remaining,
    closedDay: state.closedDay,
    choice: state.choice
      ? { day: state.choice.day, targetId: state.choice.targetId, skill: state.choice.skill }
      : null,
  };
}
export function canMerchantTrade(state: MerchantReadState, day: number): boolean {
  return state.remaining > 0 && day >= 1 && (state.closedDay === null || state.closedDay < day);
}

/** Caller keeps original wait/currentness/commit boundaries; this closes only day. */
export function closeMerchantTrade(state: MerchantReadState, day: number): void {
  (state as { closedDay: number | null }).closedDay = day;
}
/** Original paid trade writes stock, day then the same stored choice object. */
export function recordMerchantTrade(
  state: MerchantReadState,
  day: number,
  targetId: number,
  skill: MiracleSkill,
): void {
  (state as { remaining: 0 | 1 }).remaining = 0;
  (state as { closedDay: number | null }).closedDay = day;
  (state as { choice: MerchantState["choice"] }).choice = {
    day,
    targetId,
    skill: skill as MiracleSkill,
  };
}
