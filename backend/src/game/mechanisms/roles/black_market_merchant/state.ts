import type { PlayerBlackMarketState } from "../player_extended_state";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { copyAbilityData } from "../abilities";
export type BlackMarketSkill = "check" | "poison" | "gun";
export interface BlackMarketState { remaining: 0 | 1; closedDay: number | null; choice: { day: number; targetId: number; skill: BlackMarketSkill } | null }
export const freshBlackMarketState = (): BlackMarketState => ({ remaining: 1, closedDay: null, choice: null });
export function getBlackMarketState(role: RoleComponent | undefined): BlackMarketState | undefined { return role?.privateState.black_market_merchant as BlackMarketState | undefined; }
export function setBlackMarketState(role: RoleComponent, state: BlackMarketState): void { role.privateState.black_market_merchant = copyAbilityData(state); }
export function projectBlackMarketState(state: BlackMarketState): PlayerBlackMarketState { return { remaining: state.remaining, closedDay: state.closedDay, choice: state.choice ? { day: state.choice.day, targetId: state.choice.targetId, skill: state.choice.skill } : null }; }
export function canBlackMarketTrade(state: BlackMarketState, day: number): boolean { return state.remaining === 1 && day >= 1 && (state.closedDay === null || state.closedDay < day); }
