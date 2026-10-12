/**
 * Owns pure Nightmare fear contracts for wire consumers.
 * Inputs are event names and proven inert payloads; outputs are detached facts
 * or null under the original keys, nullable fields and numeric/history limits.
 * For inert inputs these readers never pay resources, alter phases, authorize
 * actions or render text. Reflection may trigger Proxy traps; Node ingress must
 * reject hostile objects separately before calling this browser-safe module.
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
