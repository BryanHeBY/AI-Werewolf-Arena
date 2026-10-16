/**
 * 负责方向巡猎的纯双语方向和事件标签。输入载荷/语言，输出原座位方向及消费或真实结果描述。
 * 不查询狼位、推导实际死亡或暴露未死原目标；私有paid与公共resolved由各消费方隔离。
 */
import { type PlayerText } from "../players";
import {
  readAwakenedPatrolFact,
  type PatrolDirection,
} from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import { text as defaultText, term, type Locale } from "@ai-werewolf-arena/game-text";
export function patrolDirection(
  direction: PatrolDirection,
  locale: Locale,
  text: PlayerText = defaultText,
): string {
  return text(
    locale,
    direction === "clockwise"
      ? "awakened_patrol.direction.clockwise"
      : "awakened_patrol.direction.counter_clockwise",
  );
}
export function awakenedPatrolEventLabel(
  type: string,
  payload: unknown,
  locale: Locale = "zh-CN",
  text: PlayerText = defaultText,
): string | null {
  const f = readAwakenedPatrolFact(type, payload);
  if (!f) return null;
  const p = f.payload;
  if (p.direction === null)
    return text(locale, "event.awakened_patrol_passed", { actor: p.actorId, day: p.day });
  const direction = patrolDirection(p.direction, locale, text);
  if (f.type === "awakened_patrol_paid")
    return text(locale, "event.awakened_patrol_paid", {
      actor: f.payload.actorId,
      day: f.payload.day,
      direction,
      root: term("phase", f.payload.rootPhase, locale),
      target: f.payload.targetId!,
    });
  return p.targetId === null
    ? text(locale, "event.awakened_patrol_no_death", { actor: p.actorId, day: p.day, direction })
    : text(locale, "event.awakened_patrol_resolved", {
        actor: p.actorId,
        day: p.day,
        direction,
        target: p.targetId,
      });
}
