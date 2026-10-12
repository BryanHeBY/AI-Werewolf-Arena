/**
 * Owns inert Wolf Sorcerer exchange and skip fact data for shared consumers.
 * Inputs are a machine event type and JSON.parse/no-reviver or proven inert
 * payload; outputs are the original detached fact shapes or null. Field, ID,
 * null and copy limits retain the existing reader policy. This browser reader
 * does not promise hostile Proxy zero-trap safety: Node ingress owns that check.
 * It never authorizes an action, reads a roster or resolves the mechanism effect.
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
