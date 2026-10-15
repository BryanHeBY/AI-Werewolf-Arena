/**
 * 负责噩梦之影恐惧选择的共享事实格式。输入为事件名和已确认的惰性数据，输出按原精确键集、可空目标与编号界限复制的事实，或 null。
 * 上帝事实与演员自己的事实保留不同字段形状；读取不扣次数、不封印行动或渲染文本，复制／校验异常仍返回 null。
 * 反射可执行 Proxy trap，Node 入口须先拒绝危险对象，浏览器消费者应提供惰性数据。
 */
import { copyEventData } from "../inert-event-data";
export const NIGHTMARE_EVENT_TYPE = "nightmare_fear_committed" as const;
export interface NightmareFearFact {
  actorId: number;
  day: number;
  targetId: number | null;
}
export interface NightmareOwnFearFact {
  day: number;
  targetId: number | null;
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function object(payload: unknown): Record<string, unknown> | null {
  try {
    const p = copyEventData(payload);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function keys(p: Record<string, unknown>, expected: string[]): boolean {
  return (
    Object.keys(p).length === expected.length && expected.every((key) => Object.hasOwn(p, key))
  );
}
export function readNightmareFearFact(type: string, payload: unknown): NightmareFearFact | null {
  if (type !== NIGHTMARE_EVENT_TYPE) return null;
  const p = object(payload);
  return p &&
    keys(p, ["actorId", "day", "targetId"]) &&
    positive(p.actorId) &&
    positive(p.day) &&
    (p.targetId === null || (positive(p.targetId) && p.targetId !== p.actorId))
    ? (p as unknown as NightmareFearFact)
    : null;
}
// 自身通知没有 actorId；其目标形状与上帝事实分开读取，不从通知推断当前禁选范围。
export function readNightmareOwnFearFact(
  type: string,
  payload: unknown,
): NightmareOwnFearFact | null {
  if (type !== NIGHTMARE_EVENT_TYPE) return null;
  const p = object(payload);
  return p &&
    keys(p, ["day", "targetId"]) &&
    positive(p.day) &&
    (p.targetId === null || positive(p.targetId))
    ? (p as unknown as NightmareOwnFearFact)
    : null;
}
