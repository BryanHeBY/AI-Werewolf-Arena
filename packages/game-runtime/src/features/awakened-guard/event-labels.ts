/**
 * 负责awakened-guard共享文案在终端的既有受众分类。输入为原事件、私有开关与已生成label，输出原分类行或终止用空数组。
 * 仅在同机制共享label已匹配后调用。文案仍由packages共享owner读取；本层只在原时点读取受众，不调用状态或把私有事实扩大为公开事实。
 */
import type { ScriptLiveLabelRenderer } from "../../agents/presentation/contracts";
import {
  readAwakenedGuardFact,
  awakenedGuardFactAudience,
} from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
export const AWAKENED_GUARD_LIVE_LABEL_ROWS: ScriptLiveLabelRenderer = (
  event,
  printPrivateEvents,
  protection,
) => {
  const f = readAwakenedGuardFact(event.type, event.payload)!,
    audience = awakenedGuardFactAudience(f);
  return audience === undefined
    ? [{ kind: "system", text: protection }]
    : printPrivateEvents
      ? [{ kind: audience.length ? "private" : "god", text: protection }]
      : [];
};
