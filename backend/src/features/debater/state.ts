/**
 * 负责杠精选择数据槽的初始化、描述符读取、库存消耗、选择保存与玩家投影。
 * 输入为原角色／上下文或已由窗口接受的状态和选择；输出保留同一 live 槽、选择引用与独立玩家数据。
 * 初始化先求值赋值左值的容器，再读取政策；读取排除字段访问器但不新增完整 live schema 或 Proxy 零 trap 保证。
 * 窗口拥有原体、辩论提交、局部 choice 与关闭；本族命令仅写原字段，付款或保存失败不撤回此前提交。
 * 玩家投影不替代许可或档案编码，readonly 类型不冻结库存；没有镜像、JSON 身份或新的撤销政策。
 */
import type { DebaterReadState, DebaterState } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../domain/components/role";

import { playerDataField } from "../../agents/observation/player-state-data";
import type { RoleInitializationComponent, RoleInitContext } from "../../rulesets/roles/contracts";
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

/** 原初始化完整正文：仅槽不存在时安装；政策 getter 或赋值失败照原表达式传播。 */
export function initializeDebaterState(role: RoleInitializationComponent, ctx: Pick<RoleInitContext, "boardConfig">): void {
  if (!getDebaterState(role))
    role.privateState.debater = {
      policy: ctx.boardConfig?.debater?.policy ?? "awa_melbourne_2026_speech_gap_v1",
      remaining: 1,
      choice: null,
    };
}

/** 原辩论提交已记账；只消费捕获状态，不再读取角色或在后续 choice 写入失败时退款。 */
export function consumeDebaterChallenge(state: DebaterReadState): void {
  (state as Pick<DebaterState, "remaining">).remaining = 0;
}

/** 接收窗口已创建的同一 choice 引用；不复制数据、不设置窗口局部值或提交 accepted 标记。 */
export function recordDebaterChoice(state: DebaterReadState, choice: DebaterReadState["choice"]): void {
  (state as Pick<DebaterState, "choice">).choice = choice;
}
