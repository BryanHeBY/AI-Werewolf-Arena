/**
 * 负责白狼王普通状态的初始化、同引用安装／读取、玩家投影及已捕获自爆库存消耗。
 * 输入为原角色／状态或已验证选择的库存，输出为原 live 对象、canDetonate 的实际写入或玩家库存副本。
 * get／install 不新增 schema、getter／Proxy 拒绝或冻结；readonly 仅约束读方类型。
 * 原窗口负责阶段、生命和目标资格；所选自爆提交仍先写死亡提案，再消耗本对象，后发表事件。
 * 写入或发表失败保留原前缀，不退款、不另建租约或镜像，也不负责真正标死。
 */
import type { WhiteWolfKingState, WhiteWolfKingReadState } from "@ai-werewolf-arena/game-contract";

import type { PlayerWhiteWolfKingState } from "@ai-werewolf-arena/game-contract/player-state-views";
import { playerDataField } from "../player-state-data";
import type { RoleComponent } from "../../../../core/domain/components/role";

export function setWhiteWolfKingState(
  roleComp: RoleComponent,
  state: WhiteWolfKingState,
): WhiteWolfKingReadState {
  (roleComp.privateState as { white_wolf_king: WhiteWolfKingState })["white_wolf_king"] = state;
  return state;
}

export function getWhiteWolfKingState(roleComp: RoleComponent): WhiteWolfKingReadState | undefined {
  return (roleComp.privateState as { readonly white_wolf_king?: unknown })["white_wolf_king"] as
    WhiteWolfKingReadState | undefined;
}

/** caller 保持原自爆校验、死亡提案与发表顺序；此命令仅写捕获的库存。 */
export function consumeWhiteWolfDetonation(state: WhiteWolfKingReadState): void {
  (state as { canDetonate: boolean }).canDetonate = false;
}

/** 原初始化完整写体：先形成默认数据，再由原安装函数写同一 privateState 槽；不检查角色或创建许可。 */
export function initializeWhiteWolfKingState(role: RoleComponent): void {
  setWhiteWolfKingState(role, { canDetonate: true });
}

/** 原玩家投影只接受自有数据字段为 true，输出新对象；不消费库存或授予行动资格。 */
export function projectWhiteWolfKingState(state: unknown): PlayerWhiteWolfKingState {
  return { canDetonate: playerDataField(state, "canDetonate") === true };
}
