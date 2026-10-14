/**
 * 负责狼王原私有槽的直接读取和既有安装命令。输入为原角色组件与库存；输出保留同一原对象引用。
 * set 先向 wolf_king 槽赋原值再返回，get 直接访问槽且可能执行调用方 getter；类型断言不作 schema／Proxy 校验。
 * 纯载荷／只读数据结构归公共契约；具体生命周期、付款、写权、玩家投影与检查点仍由原 owner 处理。
 * 本叶不复制或冻结库存，不保存镜像，也不判定请求或死亡开枪许可。
 */
import type { WolfKingState, WolfKingReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../core/domain/components/role";

export function setWolfKingState(roleComp: RoleComponent, state: WolfKingState): WolfKingReadState {
  (roleComp.privateState as { wolf_king: WolfKingState })["wolf_king"] = state;
  return state;
}

export function getWolfKingState(roleComp: RoleComponent): WolfKingReadState | undefined {
  return (roleComp.privateState as { readonly wolf_king?: unknown })["wolf_king"] as
    WolfKingReadState | undefined;
}
