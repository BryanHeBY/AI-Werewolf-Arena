/**
 * 负责black-market-merchant共享文案在终端的既有受众分类。输入为原事件、私有开关与已生成label，输出原分类行或终止用空数组。
 * 仅在同机制共享label已匹配后调用。文案仍由packages共享owner读取；本层只在原时点读取受众，不调用状态或把私有事实扩大为公开事实。
 */
import type { ScriptLiveLabelRenderer } from "../../agents/presentation/contracts";

export const BLACK_MARKET_MERCHANT_LIVE_LABEL_ROWS: ScriptLiveLabelRenderer = (
  event,
  printPrivateEvents,
  black,
) => {
  return printPrivateEvents
    ? [{ kind: event.type === "black_market_trade_resolved" ? "god" : "private", text: black }]
    : [];
};
