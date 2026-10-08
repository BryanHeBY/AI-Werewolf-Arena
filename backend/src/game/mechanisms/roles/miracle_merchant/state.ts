import type { RoleComponent } from "../../../../core/domain/components/role";
import { copyAbilityData } from "../abilities";

export type MiracleSkill = "check" | "poison" | "guard";
export interface MerchantState {
  remaining: 0 | 1;
  closedDay: number | null;
  choice: { day: number; targetId: number; skill: MiracleSkill } | null;
}
export const freshMerchantState = (): MerchantState => ({ remaining: 1, closedDay: null, choice: null });
export function getMerchantState(role: RoleComponent | undefined): MerchantState | undefined { return role?.privateState.miracle_merchant as MerchantState | undefined; }
export function setMerchantState(role: RoleComponent, state: MerchantState): void { role.privateState.miracle_merchant = copyAbilityData(state); }
export function projectMerchantState(state: MerchantState): MerchantState {
  return { remaining: state.remaining, closedDay: state.closedDay, choice: state.choice ? { day: state.choice.day, targetId: state.choice.targetId, skill: state.choice.skill } : null };
}
export function canMerchantTrade(state: MerchantState, day: number): boolean { return state.remaining > 0 && day >= 1 && (state.closedDay === null || state.closedDay < day); }
