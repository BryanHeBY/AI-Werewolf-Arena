/**
 * Owns Hybrid state construction, live slot reads and exemplar eligibility queries.
 * Inputs are original role/choice data and day; outputs retain the stored reference or
 * an independently copied player choice. This boundary never changes hidden membership.
 */
import type { HybridState, HybridReadState } from "@ai-werewolf-arena/game-contract";
import type { PlayerHybridState } from "../player_extended_state";
import type { RoleComponent } from "../../../../core/domain/components/role";
export const freshHybridState = (): HybridState => ({ remaining: 1, choice: null });
export function getHybridState(role: RoleComponent | undefined): HybridReadState | undefined {
  return (role as { readonly privateState: { readonly hybrid?: unknown } } | undefined)
    ?.privateState.hybrid as HybridReadState | undefined;
}
export function projectHybridState(state: HybridReadState): PlayerHybridState {
  return {
    remaining: state.remaining,
    choice: state.choice ? { day: state.choice.day, targetId: state.choice.targetId } : null,
  };
}
export function canChooseExemplar(state: HybridReadState, day: number): boolean {
  return day === 1 && state.remaining === 1 && state.choice === null;
}
