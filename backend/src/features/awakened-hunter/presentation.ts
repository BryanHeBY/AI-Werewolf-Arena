/**
 * 负责觉醒猎人唯一巡猎单位的本人双语提示。输入惰性付款/语言，输出资源与已付方向，不查询沿途阵营。
 * 已付原目标是本人历史知识，不能将其当实际死亡；实际结算仍来自独立公开事实。
 */
import type { AwakenedPatrolState } from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import { text, term, type Locale } from "@ai-werewolf-arena/game-text";
import { patrolDirection } from "@ai-werewolf-arena/game-presentation";
import type { ActionRequest } from "@ai-werewolf-arena/game-contract";

export function awakenedPatrolPromptState(
  state: AwakenedPatrolState | null,
  locale: Locale,
): string {
  const brief = text(locale, "role.awakened_hunter.brief");
  if (!state) return brief;
  const p = state.payment;
  return (
    brief +
    " " +
    text(locale, "role.awakened_hunter.state", {
      resource: text(locale, p ? "common.used" : "common.unused"),
      payment:
        p === null
          ? text(locale, "common.none")
          : p.direction === null
            ? text(locale, "awakened_patrol.pass", { day: p.day })
            : text(locale, "awakened_patrol.payment", {
                day: p.day,
                direction: patrolDirection(p.direction, locale),
                root: term("phase", p.rootPhase, locale),
                target: p.targetId!,
              }),
    })
  );
}

/** 只解释本轮已授予的工具与上下文，未命中时交回后续机制。 */
export function renderAwakenedPatrolStageHint(
  request: ActionRequest,
  queries: { locale(): Locale },
): string | undefined {
  if (request.allowedTools.includes("patrol") && request.context.patrol_seat_order !== undefined)
    return text(queries.locale(), "prompt.stage.patrol_seat_order", {
      ids: request.context.patrol_seat_order.join(" → "),
    });
}
