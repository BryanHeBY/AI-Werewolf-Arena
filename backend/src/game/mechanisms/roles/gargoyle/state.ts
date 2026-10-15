/**
 * 负责石像鬼原私态槽的读写及已选接刀标志。输入为原 Role／捕获状态；输出保持存储对象同引用，
 * 安装先写槽再返回，接刀写只改该状态标志，不再读一次容器。资格、最后狼检查和发表仍归继承协调方。
 * 纯数据形状归中立契约；这里不做 schema 拷贝、不授予当前刀权、不改阵营，晚事实失败不退款。
 */
import type { GargoyleState, GargoyleReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../domain/components/role";

export function setGargoyleState(role: RoleComponent, state: GargoyleState): GargoyleReadState {
  (role.privateState as { gargoyle: GargoyleState })["gargoyle"] = state;
  return state;
}

export function getGargoyleState(role: RoleComponent): GargoyleReadState | undefined {
  return (role.privateState as { readonly gargoyle?: unknown })["gargoyle"] as
    GargoyleReadState | undefined;
}

/** 最后狼与已继承检查仍在原调用方；这里只对捕获状态写已继承标志。 */
export function recordGargoyleKnifeInheritance(state: GargoyleReadState): void {
  (state as { hasInheritedKnife: boolean }).hasInheritedKnife = true;
}
