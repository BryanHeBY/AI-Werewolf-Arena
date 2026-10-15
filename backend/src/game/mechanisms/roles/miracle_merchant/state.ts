/**
 * 负责奇迹商人的复制安装、原槽读取、交易记录与玩家投影。输入为原角色、状态及夜间日次；
 * 输出保留选择、库存和等待资格，公开 DTO 类型归公共契约。
 * 只写所属 miracle_merchant 槽及交易字段，保持复制后安装与原字段失败顺序；
 * 不提供通用私有状态写口，不刷新库存、退款或创建行动许可。
 */
import type {
  MiracleSkill,
  MerchantState,
  MerchantReadState,
} from "@ai-werewolf-arena/game-contract";

import type { PlayerMerchantState } from "@ai-werewolf-arena/game-contract/player-state-views";
import type { RoleComponent } from "../../../../domain/components/role";
import { copyAbilityData } from "../abilities";

export const freshMerchantState = (): MerchantState => ({
  remaining: 1,
  closedDay: null,
  choice: null,
});
export function getMerchantState(role: RoleComponent | undefined): MerchantReadState | undefined {
  return (role as { readonly privateState: { readonly miracle_merchant?: unknown } } | undefined)
    ?.privateState.miracle_merchant as MerchantReadState | undefined;
}
export function setMerchantState(role: RoleComponent, state: MerchantState): void {
  (role.privateState as { miracle_merchant: MerchantState }).miracle_merchant =
    copyAbilityData(state);
}
export function projectMerchantState(state: MerchantReadState): PlayerMerchantState {
  return {
    remaining: state.remaining,
    closedDay: state.closedDay,
    choice: state.choice
      ? { day: state.choice.day, targetId: state.choice.targetId, skill: state.choice.skill }
      : null,
  };
}
export function canMerchantTrade(state: MerchantReadState, day: number): boolean {
  return state.remaining > 0 && day >= 1 && (state.closedDay === null || state.closedDay < day);
}

/** 调用方保留原等待、当前性与提交边界；这里只关闭当日机会，不消费交易库存。 */
export function closeMerchantTrade(state: MerchantReadState, day: number): void {
  (state as { closedDay: number | null }).closedDay = day;
}
/** 已获准交易先消费商人库存，再写关窗日与选择对象；Good 路径此前已接受目标资源，Wolf 在此首付。失败保留已完成字段，不回滚或补发通知。 */
export function recordMerchantTrade(
  state: MerchantReadState,
  day: number,
  targetId: number,
  skill: MiracleSkill,
): void {
  (state as { remaining: 0 | 1 }).remaining = 0;
  (state as { closedDay: number | null }).closedDay = day;
  (state as { choice: MerchantState["choice"] }).choice = {
    day,
    targetId,
    skill: skill as MiracleSkill,
  };
}
