/**
 * 负责狼术师交换与跳过的共享事实格式。输入为机器事件名和无 reviver 的 JSON.parse 数据或已确认的惰性值，输出原字段的脱离引用副本或 null。
 * 编号、可空号码对及复制上限按原规则读取，复制／校验异常返回 null；这里不查存活名单、不交换座位或支付号码资源。
 * 浏览器反射不保证危险 Proxy 零 trap，Node 入口须另行拒绝危险对象。
 */
import { copyEventData } from "../inert-event-data";
export interface WolfSorcererExchangeFact {
  actorId: number;
  day: number;
  pair: [number, number] | null;
}
export interface WolfSorcererSkipFact {
  actorId: number;
  day: number;
  reason: "exhausted" | "dead" | "not_started";
}
function data(payload: unknown): Record<string, unknown> | null {
  try {
    const p = copyEventData(payload);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function id(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}
function keys(p: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(p).length === expected.length && expected.every((k) => Object.hasOwn(p, k));
}
// null 号码对表示原空过记录；有效号码对保持递增顺序，资源是否已付仍由领域判断。
export function readWolfSorcererExchangeFact(
  type: string,
  payload: unknown,
): WolfSorcererExchangeFact | null {
  if (type !== "wolf_sorcerer_exchange_committed") return null;
  const p = data(payload);
  if (!p || !keys(p, ["actorId", "day", "pair"]) || !id(p.actorId) || !id(p.day)) return null;
  if (
    p.pair !== null &&
    (!Array.isArray(p.pair) ||
      p.pair.length !== 2 ||
      !id(p.pair[0]) ||
      !id(p.pair[1]) ||
      p.pair[0] >= p.pair[1])
  )
    return null;
  return p as unknown as WolfSorcererExchangeFact;
}
export function readWolfSorcererSkipFact(
  type: string,
  payload: unknown,
): WolfSorcererSkipFact | null {
  if (type !== "wolf_sorcerer_exchange_skipped") return null;
  const p = data(payload);
  if (
    !p ||
    !keys(p, ["actorId", "day", "reason"]) ||
    !id(p.actorId) ||
    !id(p.day) ||
    (p.reason !== "exhausted" && p.reason !== "dead" && p.reason !== "not_started")
  )
    return null;
  return p as unknown as WolfSorcererSkipFact;
}
