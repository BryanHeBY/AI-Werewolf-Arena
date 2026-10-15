/**
 * 负责隐狼原私态槽的读写及已选接刀标志。输入为原 Role／捕获状态；输出保持存储对象同引用，
 * 安装先写槽再返回，接刀写只改该状态标志，不再读一次容器。最后狼和已继承检查仍由调用方执行。
 * 纯数据形状归中立契约；这里不授刀权、不改阵营或重写检查点，事实晚失败不退款。
 */
import type { HiddenWolfState, HiddenWolfReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";
import type { HiddenWolfCampInspectionPolicy } from "../../../../core/domain/board";

export function setHiddenWolfState(
  role: RoleComponent,
  state: HiddenWolfState,
): HiddenWolfReadState {
  (role.privateState as { hidden_wolf: HiddenWolfState })["hidden_wolf"] = state;
  return state;
}

export function getHiddenWolfState(role: RoleComponent): HiddenWolfReadState | undefined {
  return (role.privateState as { readonly hidden_wolf?: unknown })["hidden_wolf"] as
    HiddenWolfReadState | undefined;
}

/** 最后狼与已继承检查仍在原调用方；这里只对捕获状态写已继承标志。 */
export function recordHiddenWolfKnifeInheritance(state: HiddenWolfReadState): void {
  (state as { hasInheritedKnife: boolean }).hasInheritedKnife = true;
}
