/**
 * 负责蚀时狼妃锁定、跳过、反射事实及玩家知识的公共数据契约。输入为机器事件类型与
 * 无 reviver 的 JSON.parse 或已确认 inert 载荷，输出为原脱离事实／null 或玩家 DTO 结构。
 * 字段、ID、可空值与复制限制保持原 reader 政策，公共类型唯一拥有玩家投影形状。
 * 本浏览器 reader 不承诺恶意 Proxy 零 trap，Node 准入仍负责先拒绝；数据不授予行动，
 * 不读取玩家名单、执行反射、拥有回执或写实际库存。
 */
import { copyEventData } from "../inert-event-data";
import type { ReflectionScope, TimeConsortChoice } from "../role-state-data";

/** 原可写知识字段；exhausted 是延迟告知，不携带内部触发日或当前反射权限。 */
export interface PlayerTimeConsortState {
  policy: "awa_time_consort_reflection_v1";
  reflectionScope: ReflectionScope;
  history: TimeConsortChoice[];
  exhausted: boolean;
}

export interface TimeConsortChoiceFact {
  actorId: number;
  day: number;
  targetId: number | null;
}
export interface TimeConsortSkipFact {
  actorId: number;
  day: number;
  reason: "exhausted" | "dead";
}
export interface TimeConsortReflectionFact {
  actorId: number;
  day: number;
  sourceId: number;
  requestedId: number;
  effectiveId: number;
  kind: "check" | "guard" | "poison";
}
function data(value: unknown): Record<string, unknown> | null {
  try {
    const v = copyEventData(value);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function id(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}
function keys(p: Record<string, unknown>, names: string[]): boolean {
  return Object.keys(p).length === names.length && names.every((k) => Object.hasOwn(p, k));
}
export function readTimeConsortChoiceFact(
  type: string,
  value: unknown,
): TimeConsortChoiceFact | null {
  if (type !== "time_consort_lock_committed") return null;
  const p = data(value);
  return p &&
    keys(p, ["actorId", "day", "targetId"]) &&
    id(p.actorId) &&
    id(p.day) &&
    (p.targetId === null || id(p.targetId))
    ? (p as unknown as TimeConsortChoiceFact)
    : null;
}
export function readTimeConsortSkipFact(type: string, value: unknown): TimeConsortSkipFact | null {
  if (type !== "time_consort_lock_skipped") return null;
  const p = data(value);
  return p &&
    keys(p, ["actorId", "day", "reason"]) &&
    id(p.actorId) &&
    id(p.day) &&
    (p.reason === "exhausted" || p.reason === "dead")
    ? (p as unknown as TimeConsortSkipFact)
    : null;
}
export function readTimeConsortReflectionFact(
  type: string,
  value: unknown,
): TimeConsortReflectionFact | null {
  if (type !== "time_consort_reflected") return null;
  const p = data(value);
  return p &&
    keys(p, ["actorId", "day", "sourceId", "requestedId", "effectiveId", "kind"]) &&
    [p.actorId, p.day, p.sourceId, p.requestedId, p.effectiveId].every(id) &&
    p.sourceId === p.effectiveId &&
    (p.kind === "check" || p.kind === "guard" || p.kind === "poison")
    ? (p as unknown as TimeConsortReflectionFact)
    : null;
}
