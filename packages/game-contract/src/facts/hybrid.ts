/**
 * Responsibility: read the existing Hybrid label facts without rendering.
 * Input: proven inert payloads and event names; output: selected validated fields
 * or null under the original shallow descriptor and branch conditions. Unused
 * fields and symbols retain their original acceptance and are not copied out.
 * This reader never applies effects, writes state or grants action authority.
 * Browser reflection may throw or trigger Proxy traps; Node ingress must reject
 * hostile objects separately. No recursive copier or stricter schema is added.
 */
export type HybridEventFact =
  | { type: "hybrid_exemplar_chosen"; actorId: number; day: 1; targetId: number }
  | {
      type: "hybrid_affiliation_resolved";
      actorId: number;
      day: 1;
      targetId: number;
      faction: "good" | "wolf";
    };
export function readHybridEventFact(type: string, payload: unknown): HybridEventFact | null {
  if (type !== "hybrid_exemplar_chosen" && type !== "hybrid_affiliation_resolved") return null;
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
  const allowed =
    type === "hybrid_exemplar_chosen"
      ? ["actorId", "day", "targetId"]
      : ["actorId", "day", "targetId", "faction"];
  if (
    Object.keys(p).some((key) => !allowed.includes(key)) ||
    !positive(p.actorId) ||
    p.day !== 1 ||
    !positive(p.targetId) ||
    p.actorId === p.targetId
  )
    return null;
  if (type === "hybrid_exemplar_chosen")
    return { type, actorId: p.actorId, day: p.day, targetId: p.targetId };
  return p.faction === "good" || p.faction === "wolf"
    ? {
        type: "hybrid_affiliation_resolved",
        actorId: p.actorId,
        day: p.day,
        targetId: p.targetId,
        faction: p.faction,
      }
    : null;
}
