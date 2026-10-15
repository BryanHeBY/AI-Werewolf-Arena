/**
 * 负责狼美人原私态槽及普通魅惑历史写。输入为原 Role／捕获状态、可空目标及 day；
 * 输出保持对象同引用、槽安装和字段写序。选择依次写 targetId、lastActedDay、再 push history，
 * 中途错误保留已完成前缀；目标资格、魅惑绑定、使用登记与发表仍归调用方。
 * 纯 payload 形状归中立契约，这里不重复校验、退款、改变死亡连带政策或重算真实阵营。
 */
import type { WolfBeautyState, WolfBeautyReadState } from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../../../domain/components/role";
import type { EntityId } from "@ai-werewolf-arena/game-contract";

export function setWolfBeautyState(
  roleComp: RoleComponent,
  state: WolfBeautyState,
): WolfBeautyReadState {
  (roleComp.privateState as { wolf_beauty: WolfBeautyState })["wolf_beauty"] = state;
  return state;
}

export function getWolfBeautyState(roleComp: RoleComponent): WolfBeautyReadState | undefined {
  return (roleComp.privateState as { readonly wolf_beauty?: unknown })["wolf_beauty"] as
    WolfBeautyReadState | undefined;
}

/** 调用方保全部前检和随后使用／效果／发表操作；此处三次写中途失败不回滚。 */
export function recordCharmSelection(
  state: WolfBeautyReadState,
  targetId: EntityId | null,
  day: number,
): void {
  (state as { targetId: EntityId | null }).targetId = targetId;
  (state as { lastActedDay: number | null }).lastActedDay = day;
  (state.history as WolfBeautyState["history"]).push({ day, targetId });
}
