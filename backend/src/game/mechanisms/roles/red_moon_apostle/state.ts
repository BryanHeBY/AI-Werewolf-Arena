import { types } from "node:util";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp } from "../../../../core/domain/identity";

export const RED_MOON_ROLE = "red_moon_apostle" as const;
export const RED_MOON_POLICY = "awa_red_moon_demon_v1" as const;
export type LastWolfBlastPolicy = "ends_game" | "forbidden";
export interface RedMoonState {
  policy: typeof RED_MOON_POLICY;
  lastWolfBlastPolicy: LastWolfBlastPolicy;
  blastDay: number | null;
  exileDay: number | null;
  expirySettled: boolean;
}
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && "value" in field ? field.value : undefined;
}
function day(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
export function freshRedMoonState(
  lastWolfBlastPolicy: LastWolfBlastPolicy = "ends_game",
): RedMoonState {
  return {
    policy: RED_MOON_POLICY,
    lastWolfBlastPolicy,
    blastDay: null,
    exileDay: null,
    expirySettled: false,
  };
}
export function getRedMoonState(role: RoleComponent | undefined): RedMoonState | undefined {
  if (own(role, "role") !== RED_MOON_ROLE || own(role, "camp") !== Camp.Wolf) return undefined;
  const state = own(own(role, "privateState"), "redMoon");
  if (!state || typeof state !== "object" || types.isProxy(state)) return undefined;
  const expected = ["policy", "lastWolfBlastPolicy", "blastDay", "exileDay", "expirySettled"];
  const fields = Object.getOwnPropertyDescriptors(state);
  if (
    Reflect.ownKeys(fields).length !== expected.length ||
    !expected.every((key) => fields[key] && "value" in fields[key]!)
  )
    return undefined;
  const policy = own(state, "lastWolfBlastPolicy");
  const blast = own(state, "blastDay"),
    exile = own(state, "exileDay");
  const settled = own(state, "expirySettled");
  if (
    own(state, "policy") !== RED_MOON_POLICY ||
    (policy !== "ends_game" && policy !== "forbidden") ||
    (blast !== null && !day(blast)) ||
    (exile !== null && !day(exile)) ||
    (blast !== null && exile !== null) ||
    typeof settled !== "boolean" ||
    (settled && exile === null)
  )
    return undefined;
  return state as RedMoonState;
}
