/**
 * 负责预言家已授权查验事件的脚本展示贡献。输入为事件、是否允许私有输出与语言；输出为原查验文案，仅在原私有输出许可下渲染。不会查验目标、写历史或扩大事件受众。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { readSeerInspectionResult } from "@ai-werewolf-arena/replay-contract";
import type { ScriptLiveRenderHandlers } from "../../script/contracts";
export const SEER_SCRIPT_LIVE_HANDLERS: ScriptLiveRenderHandlers = {
  seer_checked: (event, printPrivateEvents, locale = "zh-CN") => {
    if (!printPrivateEvents) return [];
    const result = readSeerInspectionResult(event.payload);
    let label = result ? inspectionLabel(result, locale) : "?";
    if (!result) {
      try {
        const raw = Object.getOwnPropertyDescriptor(event.payload, "result");
        if (raw && Object.hasOwn(raw, "value")) label = JSON.stringify(raw.value) ?? "?";
      } catch {
        /* Invalid non-JSON diagnostic values remain unknown. */
      }
    }
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
