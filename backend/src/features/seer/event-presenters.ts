/**
 * 负责预言家已查验事件的脚本展示贡献。输入为事件、是否打印私有输出与语言；
 * 输出为原查验文案，仅在该选项开启后读取／渲染结果。无有效 reader 结果时按原 own-data／JSON 诊断回退，
 * 不查验目标、写历史、证明 payload 授权或扩大原事件受众。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "@ai-werewolf-arena/game-presentation";
import { readSeerInspectionResult } from "@ai-werewolf-arena/replay-contract";
import type { ScriptLiveRenderHandlers } from "../../agents/presentation/contracts";
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
        /* 无法 JSON 编码的诊断值仍显示未知，不把异常值解释为额外查验结果。 */
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
