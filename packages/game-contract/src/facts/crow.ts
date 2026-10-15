/**
 * 负责乌鸦公共状态数据和严格事件读器，输入为inert载荷与机器事件类型，输出脱离事实或null。
 * 公共结构只包含自身选择或匿名附加票，不携带World、原生命、夜窗或加票许可。
 * 字段宽度和可空目标严格校验，浏览器反射边界由外层准入负责，不从相似JSON恢复授权。
 */
import { copyEventData } from "../inert-event-data";
import type { CrowConfig } from "../boards";
export interface CrowState extends CrowConfig {
  history: Array<{ day: number; targetId: number | null }>;
}
export type CrowChoiceFact = { actorId: number; day: number; targetId: number | null };
export type CrowBonusFact = { day: number; targetId: number; bonus: 1; round: 1 | 2 };
export function readCrowFact(
  type: string,
  payload: unknown,
): CrowChoiceFact | CrowBonusFact | null {
  if (type !== "crow_curse_chosen" && type !== "crow_curse_applied") return null;
  try {
    const p = copyEventData(payload);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const r = p as Record<string, unknown>;
    const id = (v: unknown): v is number =>
      typeof v === "number" && Number.isSafeInteger(v) && v > 0;
    if (
      type === "crow_curse_chosen" &&
      Object.keys(r).length === 3 &&
      id(r.actorId) &&
      id(r.day) &&
      (r.targetId === null || id(r.targetId))
    )
      return { actorId: r.actorId, day: r.day, targetId: r.targetId };
    if (
      type === "crow_curse_applied" &&
      Object.keys(r).length === 4 &&
      id(r.day) &&
      id(r.targetId) &&
      r.bonus === 1 &&
      (r.round === 1 || r.round === 2)
    )
      return { day: r.day, targetId: r.targetId, bonus: 1, round: r.round };
    return null;
  } catch {
    return null;
  }
}
