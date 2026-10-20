/**
 * 负责黑市商人的状态安装、原槽读取、交易记录与玩家投影。输入为原角色、状态和交易日次；
 * 输出为复制安装后的状态、原只读引用或裁剪数据，实际类型归公共玩家视图契约。
 * 本模块只写所属 black_market_merchant 槽及交易字段，不替换角色容器、退款或创建行动许可。
 * 次数、关窗日和选择按原顺序提交；复制或字段写入失败保留此前已经完成的前缀。
 */
import type {
  BlackMarketSkill,
  BlackMarketState,
  BlackMarketReadState,
} from "@ai-werewolf-arena/game-contract";

import type { PlayerBlackMarketState } from "@ai-werewolf-arena/game-contract/player-state-views";
import type { RoleComponent } from "../../domain/components/role";
import { copyAbilityData } from "../night-abilities/inventory-ports";

export const freshBlackMarketState = (): BlackMarketState => ({
  remaining: 1,
  closedDay: null,
  choice: null,
});
export function getBlackMarketState(
  role: RoleComponent | undefined,
): BlackMarketReadState | undefined {
  return (
    role as { readonly privateState: { readonly black_market_merchant?: unknown } } | undefined
  )?.privateState.black_market_merchant as BlackMarketReadState | undefined;
}
export function setBlackMarketState(role: RoleComponent, state: BlackMarketState): void {
  (role.privateState as { black_market_merchant: BlackMarketState }).black_market_merchant =
    copyAbilityData(state);
}
export function projectBlackMarketState(state: BlackMarketReadState): PlayerBlackMarketState {
  return {
    remaining: state.remaining,
    closedDay: state.closedDay,
    choice: state.choice
      ? { day: state.choice.day, targetId: state.choice.targetId, skill: state.choice.skill }
      : null,
  };
}
export function canBlackMarketTrade(state: BlackMarketReadState, day: number): boolean {
  return state.remaining === 1 && day >= 1 && (state.closedDay === null || state.closedDay < day);
}

/** 调用方保留原等待、当前性与提交边界；这里只关闭当日机会，不消费交易库存。 */
export function closeBlackMarketTrade(state: BlackMarketReadState, day: number): void {
  (state as { closedDay: number | null }).closedDay = day;
}
/** 已获准交易先消费商人库存，再写关窗日与选择对象；Good 路径此前已接受目标资源，Wolf 在此首付。失败保留已完成字段，不回滚或补发通知。 */
export function recordBlackMarketTrade(
  state: BlackMarketReadState,
  day: number,
  targetId: number,
  skill: BlackMarketSkill,
): void {
  (state as { remaining: 0 | 1 }).remaining = 0;
  (state as { closedDay: number | null }).closedDay = day;
  (state as { choice: BlackMarketState["choice"] }).choice = { day, targetId, skill };
}
