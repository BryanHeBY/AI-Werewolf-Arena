/**
 * 负责混血儿完整选择数据的初态、原槽初始化／读取、首夜库存条件与玩家投影。
 * 输入是原初始化角色，或已获准提交的状态、日次和榜样编号；输出保留同一存储对象与独立选择副本。
 * 初始化保查槽→左值容器→初态创建顺序；选择先消费次数，再写 choice，随后 Victory 安装仍由原夜阶段负责。
 * 本槽不改变 live 接受集合，不新增 schema、生命许可、深冻结或私有档案 codec；失败保留已经完成的字段前缀。
 */
import type { HybridState, HybridReadState } from "@ai-werewolf-arena/game-contract";
import type { PlayerHybridState } from "@ai-werewolf-arena/game-contract/player-state-views";
import type { RoleComponent } from "../../domain/components/role";
import type { RoleInitializationComponent } from "../../rulesets/roles/contracts";
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

/** 原完整初始化：保留既有槽；原容器左值在 fresh 初态调用之前读取，不另建镜像。 */
export function installHybridState(role: RoleInitializationComponent): void {
  if (!getHybridState(role)) role.privateState.hybrid = freshHybridState();
}

/** 原胜利归属对象已在调用前构造；这里按原次序写两字段，不安装 Victory，也不在后续安装失败时退款。 */
export function commitHybridChoice(state: HybridReadState, day: number, targetId: number): void {
  (state as Pick<HybridState, "remaining">).remaining = 0;
  (state as Pick<HybridState, "choice">).choice = { day, targetId };
}
