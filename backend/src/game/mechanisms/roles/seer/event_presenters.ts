import { text, inspectionLabel } from "@ai-werewolf-arena/game-text";
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
