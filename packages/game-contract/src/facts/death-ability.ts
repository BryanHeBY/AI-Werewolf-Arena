/**
 * Responsibility: read the existing Death Ability label facts without rendering.
 * Input: proven inert payloads and event names; output: selected validated fields
 * or null under the original shallow descriptor and branch conditions. Unused
 * fields and symbols retain their original acceptance and are not copied out.
 * This reader never applies effects, writes state or grants action authority.
 * Browser reflection may throw or trigger Proxy traps; Node ingress must reject
 * hostile objects separately. No recursive copier or stricter schema is added.
 */
export interface DeathAbilityEventFact {
  type: "death_ability_changed";
  actorId: number;
  abilityId: string;
  grantedNight: number;
  armedOnNight: number | null;
  remaining: 0 | 1;
  disabled: boolean;
  deathExpired: boolean;
  operation: "granted" | "armed" | "disabled" | "enabled" | "transferred_out";
}
export function readDeathAbilityEventFact(
  type: string,
  payload: unknown,
): DeathAbilityEventFact | null {
  if (type !== "death_ability_changed") return null;
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
  if (
    !positive(p.actorId) ||
    typeof p.abilityId !== "string" ||
    !/^[a-z][a-z0-9:_-]{0,127}$/.test(p.abilityId) ||
    p.abilityId.startsWith("native:") ||
    !positive(p.grantedNight) ||
    !(p.armedOnNight === null || (positive(p.armedOnNight) && p.armedOnNight >= p.grantedNight)) ||
    ![0, 1].includes(p.remaining) ||
    typeof p.disabled !== "boolean" ||
    typeof p.deathExpired !== "boolean" ||
    !["granted", "armed", "disabled", "enabled", "transferred_out"].includes(p.operation)
  )
    return null;
  if (
    (p.operation === "armed" &&
      (p.armedOnNight === null || p.disabled || p.deathExpired || p.remaining !== 1)) ||
    (p.operation === "disabled" && !p.disabled) ||
    (p.operation === "enabled" && (p.disabled || p.deathExpired)) ||
    (p.deathExpired && (!p.disabled || p.remaining !== 0))
  )
    return null;
  return {
    type: "death_ability_changed",
    actorId: p.actorId,
    abilityId: p.abilityId,
    grantedNight: p.grantedNight,
    armedOnNight: p.armedOnNight,
    remaining: p.remaining,
    disabled: p.disabled,
    deathExpired: p.deathExpired,
    operation: p.operation,
  };
}
