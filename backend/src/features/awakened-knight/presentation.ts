/**
 * 负责觉醒骑士纯尝试历史的双语提示。输入脱离状态和语言，输出公开已用座位，
 * 不从历史推断实际死亡或给出未尝试目标阵营，不写库存、World或许可。
 */
import type { AwakenedKnightState } from "@ai-werewolf-arena/game-contract/facts/awakened-duel";
import { text, type Locale } from "@ai-werewolf-arena/game-text";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";

export function awakenedKnightPromptState(
  state: AwakenedKnightState | null,
  locale: Locale,
): string {
  const brief = text(locale, "role.awakened_knight.brief");
  if (!state) return brief;
  return (
    brief +
    " " +
    text(locale, "role.awakened_knight.state", {
      targets: state.attempts.map((a) => a.targetId).join(", ") || text(locale, "common.none"),
    })
  );
}

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderAwakenedKnightStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  if (request.allowedTools.includes("awakened_duel") && request.context.awakened_duel_options) {
    const o = request.context.awakened_duel_options;
    return text(queries.locale(), "prompt.stage.awakened_duel", {
      targets: o.targetIds.join(", "),
      continuing: String(o.continuing),
    });
  }
}
