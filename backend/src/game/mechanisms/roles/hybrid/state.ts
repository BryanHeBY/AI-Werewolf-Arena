import type { PlayerHybridState } from "../player_extended_state";
import type { RoleComponent } from "../../../../core/domain/components/role";

/** Only the actor's choice is player state. Hidden faction belongs to VictoryComponent. */
export interface HybridState {
  remaining: 0 | 1;
  choice: { day: number; targetId: number } | null;
}
export const freshHybridState = (): HybridState => ({ remaining: 1, choice: null });
export function getHybridState(role: RoleComponent | undefined): HybridState | undefined {
  return role?.privateState.hybrid as HybridState | undefined;
}
export function projectHybridState(state: HybridState): PlayerHybridState {
  return { remaining: state.remaining, choice: state.choice ? { day: state.choice.day, targetId: state.choice.targetId } : null };
}
export function canChooseExemplar(state: HybridState, day: number): boolean {
  return day === 1 && state.remaining === 1 && state.choice === null;
}
