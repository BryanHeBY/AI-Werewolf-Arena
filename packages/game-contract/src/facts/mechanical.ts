/**
 * Responsibility: read the existing Mechanical label facts without rendering.
 * Input: proven inert payloads and event names; output: selected validated fields
 * or null under the original shallow descriptor and branch conditions. Unused
 * fields and symbols retain their original acceptance and are not copied out.
 * This reader never applies effects, writes state or grants action authority.
 * Browser reflection may throw or trigger Proxy traps; Node ingress must reject
 * hostile objects separately. No recursive copier or stricter schema is added.
 */
import { isRoleId, type RoleId } from "../role-ids";
export const MECHANICAL_EVENT_TYPES = [
  "mechanical_awakened",
  "mechanical_mode_selected",
  "mechanical_mimicked",
  "mechanical_mimic_skipped",
  "mechanical_skill_skipped",
  "mechanical_poison_used",
  "mechanical_guard_chosen",
  "mechanical_attack_chosen",
  "mechanical_poison_reflected",
  "mechanical_shot",
] as const;
type Base = { actorId: number; day: number };
interface Payloads {
  mechanical_awakened: Base & { firstKnifeNight: number };
  mechanical_mode_selected: Base & { mode: "kill" | "skill" };
  mechanical_mimicked: Base & { targetId: number; role: RoleId; readyOnNight: number };
  mechanical_mimic_skipped: Base;
  mechanical_skill_skipped: Base;
  mechanical_poison_used: Base & { targetId: number };
  mechanical_guard_chosen: Base & { targetId: number | null; failed: boolean };
  mechanical_attack_chosen: Base & { targetId: number | null };
  mechanical_poison_reflected: Base & { protectedTargetId: number; casterId: number };
  mechanical_shot: { actorId: number; targetId: number };
}
export type MechanicalEventFact = {
  [K in keyof Payloads]: { type: K } & Payloads[K];
}[keyof Payloads];

export function readMechanicalEventFact(
  type: string,
  payload: unknown,
): MechanicalEventFact | null {
  if (!(MECHANICAL_EVENT_TYPES as readonly string[]).includes(type)) return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const prototype = Object.getPrototypeOf(payload);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return null;
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([name, field]) => [name, field.value]),
  );
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  const actor = p.actorId,
    day = p.day,
    target = p.targetId;
  if (!positive(actor) || (type !== "mechanical_shot" && !positive(day))) return null;
  const base = { actorId: actor, day: day as number };
  switch (type) {
    case "mechanical_awakened":
      return positive(p.firstKnifeNight)
        ? { type, ...base, firstKnifeNight: p.firstKnifeNight }
        : null;
    case "mechanical_mode_selected":
      return p.mode === "kill" || p.mode === "skill" ? { type, ...base, mode: p.mode } : null;
    case "mechanical_mimicked":
      return positive(target) && isRoleId(p.role) && positive(p.readyOnNight)
        ? { type, ...base, targetId: target, role: p.role, readyOnNight: p.readyOnNight }
        : null;
    case "mechanical_mimic_skipped":
      return { type, ...base };
    case "mechanical_skill_skipped":
      return { type, ...base };
    case "mechanical_poison_used":
      return positive(target) ? { type, ...base, targetId: target } : null;
    case "mechanical_guard_chosen":
      return (target === null || positive(target)) && typeof p.failed === "boolean"
        ? { type, ...base, targetId: target, failed: p.failed }
        : null;
    case "mechanical_attack_chosen":
      return target === null || positive(target) ? { type, ...base, targetId: target } : null;
    case "mechanical_poison_reflected":
      return positive(p.protectedTargetId) && positive(p.casterId)
        ? { type, ...base, protectedTargetId: p.protectedTargetId, casterId: p.casterId }
        : null;
    case "mechanical_shot":
      return positive(target) ? { type, actorId: actor, targetId: target } : null;
    default:
      return null;
  }
}
