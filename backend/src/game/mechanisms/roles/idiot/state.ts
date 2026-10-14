/**
 * 负责白痴普通数据槽的初始化、同引用安装／读取与玩家投影；输入为原角色及状态，输出为原 live 引用或脱离的玩家翻牌数据。
 * 安装先读取 privateState 左值再写 revealed 对象，普通 get 不执行 schema／Proxy／原型校验或冻结。
 * 普通免死分支仍由原规则组合决定是否安装新的翻牌对象，再关闭票权、处理警徽和发表事件。
 * 本 owner 不授予免死或行动权限，不替代猎魔原生审计，不回滚后续失败的已写前缀。
 */
import type { IdiotState, IdiotReadState } from "@ai-werewolf-arena/game-contract";

import type { PlayerIdiotState } from "@ai-werewolf-arena/game-contract/player-state-views";
import { playerDataField } from "../player-state-data";
import type { RoleComponent } from "../../../../core/domain/components/role";

export function setIdiotState(roleComp: RoleComponent, state: IdiotState): IdiotReadState {
  (roleComp.privateState as { idiot: IdiotState })["idiot"] = state;
  return state;
}

export function getIdiotState(roleComp: RoleComponent): IdiotReadState | undefined {
  return (roleComp.privateState as { readonly idiot?: unknown })["idiot"] as
    IdiotReadState | undefined;
}

/** 原初始化完整写体：先形成默认数据，再由原安装函数写同一 privateState 槽；不检查角色或创建许可。 */
export function initializeIdiotState(roleComp: RoleComponent): void {
  setIdiotState(roleComp, { revealed: false });
}

/** 原玩家投影只接受自有数据字段为 true，输出新对象；不消费库存或授予行动资格。 */
export function projectIdiotState(state: unknown): PlayerIdiotState {
  return { revealed: playerDataField(state, "revealed") === true };
}
