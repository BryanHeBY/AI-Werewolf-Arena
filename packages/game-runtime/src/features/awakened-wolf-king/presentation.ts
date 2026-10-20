/**
 * 负责原生双爪与受传单爪的两语自身知识展示。输入只为严格脱离状态和语言，输出库存与历史文案。
 * 原单位编号仅供本人区分消费，不是许可；这里不读取World、原生命或死亡窗口，不推导他人库存。
 * 受传者使用独立简介，不能因为持爪就在提示中把普通狼改称觉醒狼王。
 */
import type { AwakenedClawState } from "@ai-werewolf-arena/game-contract/facts/awakened-claws";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";

export function awakenedClawPromptState(state: AwakenedClawState | null, locale: Locale): string {
  const received = state?.units[0]?.source.kind === "bequest";
  const units =
    state?.units
      .map((unit) => {
        const status = text(locale, `awakened_claw.status.${unit.status}`);
        return unit.source.kind === "native"
          ? text(locale, "awakened_claw.unit.native", { index: unit.source.index, status })
          : text(locale, "awakened_claw.unit.bequest", {
              giver: unit.source.giverId,
              day: unit.source.day,
              status,
            });
      })
      .join("; ") || text(locale, "common.none");
  const bequests =
    state?.bequests
      .map((row) => text(locale, "awakened_claw.bequest", { day: row.day, target: row.targetId }))
      .join("; ") || text(locale, "common.none");
  return (
    text(locale, received ? "awakened_claw.received.brief" : "role.awakened_wolf_king.brief") +
    " " +
    text(locale, "role.awakened_wolf_king.state", { units, bequests })
  );
}

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderAwakenedClawStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  // 按原字段优先级展示请求已带来的候选，不据这些文字重新授权目标。
  if (
    request.allowedTools.includes("bequeath_claw") &&
    request.context.claw_bequest_candidates !== undefined
  )
    return text(queries.locale(), "prompt.stage.claw_bequest_candidates", {
      ids: request.context.claw_bequest_candidates.join(", "),
    });
}
