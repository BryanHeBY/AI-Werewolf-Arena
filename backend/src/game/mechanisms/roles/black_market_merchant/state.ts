/**
 * Owns Black Market Merchant's trade-state slot, copied installation and player projection.
 * Inputs are the original role/state or trade day; outputs retain copied slot data,
 * remaining stock and closed-day decisions. Only this owner restores the literal
 * black_market_merchant key at installation; no other private key write is granted.
 * It never validates a request lease, refunds a gift or replaces the role container.
 * Pure payload/read data structures belong to the neutral role-state data owner;
 * this leaf retains original live references and concrete installation/commit operations.
 */
import type {
  BlackMarketSkill,
  BlackMarketState,
  BlackMarketReadState,
} from "@ai-werewolf-arena/game-contract";

import type { PlayerBlackMarketState } from "../player_extended_state";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { copyAbilityData } from "../abilities";

export const freshBlackMarketState = (): BlackMarketState => ({
  remaining: 1,
  closedDay: null,
  choice: null,
});
export function getBlackMarketState(
  role: RoleComponent | undefined,
): BlackMarketReadState | undefined {
  return role?.privateState.black_market_merchant as BlackMarketReadState | undefined;
}
export function setBlackMarketState(role: RoleComponent, state: BlackMarketState): void {
  (role.privateState as { black_market_merchant: BlackMarketState }).black_market_merchant =
    copyAbilityData(state);
}
export function projectBlackMarketState(state: BlackMarketReadState): PlayerBlackMarketState {
  return {
    remaining: state.remaining,
    closedDay: state.closedDay,
    choice: state.choice
      ? { day: state.choice.day, targetId: state.choice.targetId, skill: state.choice.skill }
      : null,
  };
}
export function canBlackMarketTrade(state: BlackMarketReadState, day: number): boolean {
  return state.remaining === 1 && day >= 1 && (state.closedDay === null || state.closedDay < day);
}

/** Caller keeps original wait/currentness/commit boundaries; this closes only day. */
export function closeBlackMarketTrade(state: BlackMarketReadState, day: number): void {
  (state as { closedDay: number | null }).closedDay = day;
}
/** Original paid trade writes stock, day then the same stored choice object. */
export function recordBlackMarketTrade(
  state: BlackMarketReadState,
  day: number,
  targetId: number,
  skill: BlackMarketSkill,
): void {
  (state as { remaining: 0 | 1 }).remaining = 0;
  (state as { closedDay: number | null }).closedDay = day;
  (state as { choice: BlackMarketState["choice"] }).choice = { day, targetId, skill };
}
