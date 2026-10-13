/**
 * 负责混血儿初态、原槽读取、榜样选择资格和玩家投影。输入为原角色、选择数据与日次；
 * 输出为原只读存储引用或单独复制的选择，公开 DTO 类型归公共契约。
 * 本模块不写榜样选择、改变隐藏胜利归属或授予行动许可；真正选择提交由夜间机制负责。
 */
import type { HybridState, HybridReadState } from "@ai-werewolf-arena/game-contract";
import type { PlayerHybridState } from "@ai-werewolf-arena/game-contract/player-state-views";
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
