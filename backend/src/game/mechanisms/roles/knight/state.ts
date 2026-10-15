/**
 * 负责骑士普通数据槽的安装、同引用读取、初始化、玩家投影与已捕获决斗库存消耗。
 * 输入为原角色组件／状态或已通过原提交检查的库存；输出为同一 live 引用、原写入结果或脱离的玩家库存数据。
 * 普通读取和安装不运行 schema，不拒绝原 getter／原型属性／Proxy，也不复制或冻结库存。
 * 消耗只写捕获 canDuel，资格、生命、窗口和事件仍归原 caller；后续发表失败不退还资源。
 * 共享数据类型的 readonly 不是运行权限；本族不另建镜像、租约或检查点协议。
 */
import type { KnightState, KnightReadState } from "@ai-werewolf-arena/game-contract";

import type { PlayerKnightState } from "@ai-werewolf-arena/game-contract/player-state-views";
import { playerDataField } from "../player-state-data";
import type { RoleComponent } from "../../../../domain/components/role";

export function setKnightState(roleComp: RoleComponent, state: KnightState): KnightReadState {
  (roleComp.privateState as { knight: KnightState })["knight"] = state;
  return state;
}

export function getKnightState(roleComp: RoleComponent): KnightReadState | undefined {
  return (roleComp.privateState as { readonly knight?: unknown })["knight"] as
    KnightReadState | undefined;
}

/** caller 已完成原决斗前检；只消费捕获的同一对象，不再读角色槽或复验许可。 */
export function consumeKnightDuel(state: KnightReadState): void {
  (state as { canDuel: boolean }).canDuel = false;
}

/** 原初始化完整写体：先形成默认数据，再由原安装函数写同一 privateState 槽；不检查角色或创建许可。 */
export function initializeKnightState(role: RoleComponent): void {
  setKnightState(role, { canDuel: true });
}

/** 原玩家投影只接受自有数据字段为 true，输出新对象；不消费库存或授予行动资格。 */
export function projectKnightState(state: unknown): PlayerKnightState {
  return { canDuel: playerDataField(state, "canDuel") === true };
}
