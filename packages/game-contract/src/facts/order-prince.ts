/**
 * Owns the pure order-prince event payload shapes and inert-data readers used by
 * backend recording/projection and browser replay. Inputs are an event type and
 * JSON.parse data without revivers, or values already proven inert; outputs are
 * detached facts or null with the original field, nullable and ID boundaries.
 * This module never authorizes actions, settles effects, or writes role state.
 * Reflection may trigger Proxy traps; Node ingress owns hostile-object rejection.
 */
import { copyEventData } from "../inert-event-data";
export interface OrderPrinceRevoteFact {
  actorId: number;
}
export function readOrderPrinceRevoteFact(
  type: string,
  payload: unknown,
): OrderPrinceRevoteFact | null {
  if (type !== "order_prince_revote_started") return null;
  try {
    const p = copyEventData(payload);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const row = p as Record<string, unknown>;
    return Object.keys(row).length === 1 &&
      Object.hasOwn(row, "actorId") &&
      typeof row.actorId === "number" &&
      Number.isSafeInteger(row.actorId) &&
      row.actorId > 0 &&
      row.actorId < Number.MAX_SAFE_INTEGER
      ? { actorId: row.actorId }
      : null;
  } catch {
    return null;
  }
}

export interface OrderPrinceChoiceFact {
  actorId: number;
  day: number;
  activate: boolean;
}
export function readOrderPrinceChoiceFact(
  type: string,
  payload: unknown,
): OrderPrinceChoiceFact | null {
  if (type !== "order_prince_choice_committed") return null;
  try {
    const p = copyEventData(payload);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const row = p as Record<string, unknown>;
    const positive = (n: unknown) =>
      typeof n === "number" && Number.isSafeInteger(n) && n > 0 && n < Number.MAX_SAFE_INTEGER;
    return Object.keys(row).length === 3 &&
      ["actorId", "day", "activate"].every((k) => Object.hasOwn(row, k)) &&
      positive(row.actorId) &&
      positive(row.day) &&
      typeof row.activate === "boolean"
      ? { actorId: row.actorId as number, day: row.day as number, activate: row.activate }
      : null;
  } catch {
    return null;
  }
}
