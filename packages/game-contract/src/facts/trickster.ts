/**
 * Owns the pure trickster event payload shapes and inert-data readers used by
 * backend recording/projection and browser replay. Inputs are an event type and
 * JSON.parse data without revivers, or values already proven inert; outputs are
 * detached facts or null with the original field, nullable and ID boundaries.
 * This module never authorizes actions, settles effects, or writes role state.
 * Reflection may trigger Proxy traps; Node ingress owns hostile-object rejection.
 */
import { copyEventData } from "../inert-event-data";
export interface TricksterExchangeFact {
  actorId: number;
  day: number;
  pair: [number, number] | null;
}
export interface TricksterSkipFact {
  actorId: number;
  day: number;
  reason: "exhausted" | "dead";
}
export interface ExileMappingFact {
  requestedId: number;
  effectiveId: number;
  missed: boolean;
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
export function readTricksterExchangeFact(
  type: string,
  payload: unknown,
): TricksterExchangeFact | null {
  if (type !== "trickster_exchange_committed") return null;
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
  return p as unknown as TricksterExchangeFact;
}
export function readTricksterSkipFact(type: string, payload: unknown): TricksterSkipFact | null {
  if (type !== "trickster_exchange_skipped") return null;
  const p = data(payload);
  if (
    !p ||
    !keys(p, ["actorId", "day", "reason"]) ||
    !id(p.actorId) ||
    !id(p.day) ||
    (p.reason !== "exhausted" && p.reason !== "dead")
  )
    return null;
  return p as unknown as TricksterSkipFact;
}
export function readExileMappingFact(type: string, payload: unknown): ExileMappingFact | null {
  if (type !== "exile_target_mapped") return null;
  const p = data(payload);
  if (
    !p ||
    !keys(p, ["requestedId", "effectiveId", "missed"]) ||
    !id(p.requestedId) ||
    !id(p.effectiveId) ||
    typeof p.missed !== "boolean"
  )
    return null;
  if (p.missed && p.requestedId === p.effectiveId) return null;
  return p as unknown as ExileMappingFact;
}
