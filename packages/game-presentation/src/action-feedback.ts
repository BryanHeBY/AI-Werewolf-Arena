/**
 * 负责终端及 Web 共用的私有执行反馈文案。输入为已通过玩家投影的回执与语言，输出为自然语言摘要。
 * 不读取 World、不扩大事件可见性，不推算实际伤害、保护或库存；未知内容保持工具名摘要。
 */
import type { ActionExecutionReceipt } from "@ai-werewolf-arena/game-contract";
import { readInspectionResult, readSeerInspectionResult } from "@ai-werewolf-arena/replay-contract";
import { text, term, type Locale } from "@ai-werewolf-arena/game-text";
import { inspectionLabel } from "./results";
import {
  awakenedEventLabel,
  mechanicalEventLabel,
  merchantEventLabel,
  blackMarketEventLabel,
} from "./events/abilities";
import {
  thiefEventLabel,
  shapeshifterEventLabel,
  hybridEventLabel,
  wildChildEventLabel,
  lonelyGirlEventLabel,
} from "./events/relationships";
import { fragrantPairEventLabel } from "./events/night-mechanisms";

export function actionExecutionBody(receipt: ActionExecutionReceipt, locale: Locale): string {
  const lines = receipt.feedback.events
    .map(({ type, payload: p }) => {
      const actor = Number(p.actorId),
        target = Number(p.targetId);
      switch (type) {
        case "seer_checked": {
          const result = readSeerInspectionResult(p);
          return result
            ? text(locale, "replay.check", { actor, target, camp: inspectionLabel(result, locale) })
            : null;
        }
        case "role_inspected": {
          const result = readInspectionResult(p.result);
          return result
            ? text(locale, "console.role_inspected", {
                actor,
                target,
                result: inspectionLabel(result, locale),
              })
            : null;
        }
        case "role_inspection_skipped":
          return p.reason === "passed" || p.reason === "no_targets"
            ? text(locale, "console.role_inspection.skipped", {
                actor,
                day: Number(p.day),
                reason: text(
                  locale,
                  p.reason === "passed" ? "inspection.skip.passed" : "inspection.skip.no_targets",
                ),
              })
            : null;
        case "guard_applied":
          return p.abstain === true || p.targetId === null
            ? text(locale, "replay.guard_skip", { actor })
            : text(locale, "replay.guard", { actor, target });
        case "witch_potion_used":
          return text(locale, "replay.potion", {
            actor,
            target,
            potion: term("potion", p.potionType === "heal" ? "heal" : "poison", locale),
          });
        case "witch_potion_skipped":
          return text(locale, "replay.potion_skip", { actor });
        case "dream_applied":
          return text(locale, "console.dream.applied", {
            actor,
            day: Number(p.day),
            target,
            consecutive:
              p.consecutive === true ? text(locale, "common.yes") : text(locale, "common.no"),
          });
        case "charm_applied":
          return text(locale, "console.charm.applied", {
            actor,
            day: Number(p.day),
            target: p.targetId === null ? text(locale, "common.none") : target,
          });
        default:
          return [
            awakenedEventLabel,
            mechanicalEventLabel,
            merchantEventLabel,
            blackMarketEventLabel,
            thiefEventLabel,
            shapeshifterEventLabel,
            hybridEventLabel,
            wildChildEventLabel,
            lonelyGirlEventLabel,
            fragrantPairEventLabel,
          ]
            .map((render) => render(type, p, locale))
            .find(Boolean);
      }
    })
    .filter(Boolean);
  return [
    receipt.action,
    ...lines,
    ...(receipt.status === "committed" ? [text(locale, "runtime.action.pending_effects")] : []),
  ].join(" · ");
}
