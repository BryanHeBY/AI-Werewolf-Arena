/**
 * Responsibility: read the existing Merchant label facts without rendering.
 * Input: proven inert payloads and event names; output: selected validated fields
 * or null under the original shallow descriptor and branch conditions. Unused
 * fields and symbols retain their original acceptance and are not copied out.
 * This reader never applies effects, writes state or grants action authority.
 * Browser reflection may throw or trigger Proxy traps; Node ingress must reject
 * hostile objects separately. No recursive copier or stricter schema is added.
 * Resolved candidates deliberately retain an unknown used outcome for a second
 * validation after skill rendering; they are partial reads, not archival DTOs.
 */
type Trade = {
  actorId: number;
  day: number;
  targetId: number;
  skill: "check" | "poison" | "guard";
};
/** A resolved prefix has not established a valid outcome and must never authorize or settle a trade. */
export type MerchantRenderableFact =
  | { type: "merchant_trade_skipped"; actorId: number; day: number }
  | ({ type: "merchant_trade_committed" } & Trade)
  | ({ type: "merchant_trade_resolved"; outcome: unknown } & Trade);
export function readMerchantRenderableFact(
  type: string,
  payload: unknown,
): MerchantRenderableFact | null {
  if (
    !["merchant_trade_committed", "merchant_trade_skipped", "merchant_trade_resolved"].includes(
      type,
    )
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
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!positive(p.actorId) || !positive(p.day)) return null;
  const actor = p.actorId,
    day = p.day;
  if (type === "merchant_trade_skipped")
    return { type: "merchant_trade_skipped", actorId: actor, day };
  if (!positive(p.targetId) || !["check", "poison", "guard"].includes(p.skill)) return null;
  const trade = { actorId: actor, day, targetId: p.targetId, skill: p.skill as Trade["skill"] };
  if (type === "merchant_trade_committed") return { type, ...trade };
  return { type: "merchant_trade_resolved", ...trade, outcome: p.outcome };
}
/** This second-stage field check runs only after the caller's skill formatter. */
export function readMerchantOutcome(value: unknown): "granted" | "backlash" | null {
  return value === "granted" || value === "backlash" ? value : null;
}
