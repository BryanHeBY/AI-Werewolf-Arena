/**
 * 负责预言家已查验事件的脚本展示贡献。输入为事件、是否打印私有输出与语言；
 * 输出为查验文案，仅在该选项开启后读取／渲染结果。未知结果显示明确的未知标签，原始数据保留在记录中，
 * 不查验目标、写历史、证明 payload 授权或扩大原事件受众。
 */
import { type PlayerText } from "@ai-werewolf-arena/game-presentation";
import { text as defaultText } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { readSeerInspectionResult } from "@ai-werewolf-arena/replay-contract";
import type { ScriptLiveRenderHandlers } from "../../agents/presentation/contracts";
export const SEER_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  seer_checked: (event, printPrivateEvents, locale = "zh-CN", text: PlayerText = defaultText) => {
    if (!printPrivateEvents) return [];
    const result = readSeerInspectionResult(event.payload);
    const label = result ? inspectionLabel(result, locale, text) : text(locale, "common.unknown");
    return [
      {
        kind: "private",
        text: text(locale, "console.live.check", {
          actor: event.payload.actorId,
          target: event.payload.targetId,
          camp: label,
        }),
      },
    ];
  },
};
