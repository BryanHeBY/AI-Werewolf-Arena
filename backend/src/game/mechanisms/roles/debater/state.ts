/**
 * 负责杠精原数据槽的描述符读取与玩家选择投影。输入为原角色／选择数据及提交标记；
 * 输出为原槽只读引用，或保留原字段读取顺序的独立选择数据，结构类型归共享契约。
 * 读取排除字段访问器但不新增完整 live schema，也不为任意 Proxy 保证零 trap。
 * 本模块不执行辩论、写选择／库存或结算死亡，玩家投影不能代替许可、真实付款或档案编码。
 */
import type { DebaterReadState } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../../core/domain/components/role";

import { playerDataField } from "../player-state-data";
export function getDebaterState(role: RoleComponent | undefined): DebaterReadState | undefined {
  return playerDataField(playerDataField(role, "privateState"), "debater") as
    DebaterReadState | undefined;
}
/** 提交标记只使玩家视图的 remaining 归零；不写原槽，选择仅在日期与编号为正整数时输出。 */
export function projectDebaterState(state: DebaterReadState, committed = false) {
  const choice = playerDataField(state, "choice"),
    day = playerDataField(choice, "day"),
    targetId = playerDataField(choice, "targetId");
  return {
    policy: "awa_melbourne_2026_speech_gap_v1" as const,
    remaining:
      !committed && playerDataField(state, "remaining") === 1 ? (1 as const) : (0 as const),
    choice:
      typeof day === "number" &&
      Number.isSafeInteger(day) &&
      day > 0 &&
      typeof targetId === "number" &&
      Number.isSafeInteger(targetId) &&
      targetId > 0
        ? { day, targetId }
        : null,
  };
}
