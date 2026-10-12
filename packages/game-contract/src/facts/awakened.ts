/**
 * Responsibility: read the existing Awakened label facts without rendering.
 * Input: proven inert payloads and event names; output: selected validated fields
 * or null under the original shallow descriptor and branch conditions. Unused
 * fields and symbols retain their original acceptance and are not copied out.
 * This reader never applies effects, writes state or grants action authority.
 * Browser reflection may throw or trigger Proxy traps; Node ingress must reject
 * hostile objects separately. No recursive copier or stricter schema is added.
 */
import { isRoleId, type RoleId } from "../role-ids";
export const AWAKENED_EVENT_TYPES = [
  "awakened_inherited",
  "awakened_mimicked",
  "awakened_mimic_skipped",
  "awakened_ready",
  "awakened_skill_skipped",
  "awakened_poison_used",
  "awakened_guard_chosen",
  "awakened_attack_chosen",
] as const;
type Base = { actorId: number; day: number };
interface Payloads {
  awakened_inherited: Base & { firstKnifeNight: number };
  awakened_mimicked: Base & { targetId: number; role: RoleId };
  awakened_ready: {
    actorId: number;
    activationNight: number;
    activeFromNight: number;
    role: RoleId;
  };
  awakened_mimic_skipped: Base;
  awakened_skill_skipped: Base;
  awakened_poison_used: Base & { targetId: number };
  awakened_guard_chosen: Base & { targetId: number | null };
  awakened_attack_chosen: Base & { targetId: number | null };
}
export type AwakenedEventFact = {
  [K in keyof Payloads]: { type: K } & Payloads[K];
}[keyof Payloads];

export function readAwakenedEventFact(type: string, payload: unknown): AwakenedEventFact | null {
  if (!(AWAKENED_EVENT_TYPES as readonly string[]).includes(type)) return null;
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
  const actor = p.actorId,
    day = p.day,
    target = p.targetId;
  if (!positive(actor) || (type !== "awakened_ready" && !positive(day))) return null;
  const base = { actorId: actor, day: day as number };
  switch (type) {
    case "awakened_inherited":
      return positive(p.firstKnifeNight)
        ? { type, ...base, firstKnifeNight: p.firstKnifeNight }
        : null;
    case "awakened_mimicked":
      return positive(target) && target !== actor && isRoleId(p.role)
        ? { type, ...base, targetId: target, role: p.role }
        : null;
    case "awakened_ready":
      return positive(p.activationNight) &&
        positive(p.activeFromNight) &&
        p.activeFromNight === p.activationNight + 1 &&
        isRoleId(p.role)
        ? {
            type,
            actorId: actor,
            activationNight: p.activationNight,
            activeFromNight: p.activeFromNight,
            role: p.role,
          }
        : null;
    case "awakened_mimic_skipped":
      return { type, ...base };
    case "awakened_skill_skipped":
      return { type, ...base };
    case "awakened_poison_used":
      return positive(target) ? { type, ...base, targetId: target } : null;
    case "awakened_guard_chosen":
    case "awakened_attack_chosen":
      return target === null || positive(target) ? { type, ...base, targetId: target } : null;
  }
  return null;
}
