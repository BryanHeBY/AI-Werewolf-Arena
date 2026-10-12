/**
 * Responsibility: read the existing Black Market label facts without rendering.
 * Input: proven inert payloads and event names; output: selected validated fields
 * or null under the original shallow descriptor and branch conditions. Unused
 * fields and symbols retain their original acceptance and are not copied out.
 * This reader never applies effects, writes state or grants action authority.
 * Browser reflection may throw or trigger Proxy traps; Node ingress must reject
 * hostile objects separately. No recursive copier or stricter schema is added.
 * Resolved candidates deliberately retain an unknown used outcome for a second
 * validation after skill rendering; they are partial reads, not archival DTOs.
 */
type Trade = { actorId: number; day: number; targetId: number; skill: "check" | "poison" | "gun" };
/** A resolved prefix has not established a valid outcome and is not a strict archive DTO. */
export type BlackMarketRenderableFact =
  | { type: "black_market_trade_skipped"; actorId: number; day: number }
  | ({ type: "black_market_trade_committed" } & Trade)
  | ({ type: "black_market_trade_resolved"; outcome: unknown } & Trade);
export function readBlackMarketRenderableFact(
  type: string,
  payload: unknown,
): BlackMarketRenderableFact | null {
  if (
    ![
      "black_market_trade_committed",
      "black_market_trade_skipped",
      "black_market_trade_resolved",
    ].includes(type)
  )
    return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const prototype = Object.getPrototypeOf(payload),
    descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return null;
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([key, field]) => [key, field.value]),
  );
  const positive = (v: unknown): v is number =>
    typeof v === "number" && Number.isSafeInteger(v) && v > 0;
  if (!positive(p.actorId) || !positive(p.day)) return null;
  if (type === "black_market_trade_skipped")
    return { type: "black_market_trade_skipped", actorId: p.actorId, day: p.day };
  if (
    !positive(p.targetId) ||
    p.actorId === p.targetId ||
    !["check", "poison", "gun"].includes(p.skill)
  )
    return null;
  const trade = {
    actorId: p.actorId,
    day: p.day,
    targetId: p.targetId,
    skill: p.skill as Trade["skill"],
  };
  if (type === "black_market_trade_committed") return { type, ...trade };
  return { type: "black_market_trade_resolved", ...trade, outcome: p.outcome };
}
/** This second-stage field check runs only after the caller's skill formatter. */
export function readBlackMarketOutcome(value: unknown): "granted" | "backlash" | null {
  return value === "granted" || value === "backlash" ? value : null;
}
