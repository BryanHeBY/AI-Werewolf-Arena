import { copyEventData } from "./event-data";
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
