import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../core";
export const WOLF_SORCERER_ROLE = "wolf_sorcerer" as const;
export const WOLF_SORCERER_POLICY = "awa_wolf_sorcerer_seats_v1" as const;
export interface WolfSorcererChoice {
  day: number;
  pair: [number, number] | null;
}
export interface WolfSorcererState {
  policy: typeof WOLF_SORCERER_POLICY;
  firstNight: 1 | 2;
  history: WolfSorcererChoice[];
}
function field(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
function exact(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value))
    return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return (
    Reflect.ownKeys(descriptors).length === keys.length &&
    keys.every((k) => descriptors[k] && "value" in descriptors[k]!)
  );
}
function integer(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
function arrayItems(value: unknown): unknown[] | null {
  if (types.isProxy(value) || !Array.isArray(value)) return null;
  const length = field(value, "length");
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const d = descriptors[String(i)];
    if (!d || !("value" in d)) return null;
    result.push(d.value);
  }
  return result;
}
/** Validate without invoking user-owned accessors, iterators or array methods. */
export function getWolfSorcererState(
  role: RoleComponent | undefined,
): WolfSorcererState | undefined {
  if (field(role, "role") !== WOLF_SORCERER_ROLE || field(role, "camp") !== Camp.Wolf)
    return undefined;
  const state = field(field(role, "privateState"), "wolfSorcerer");
  if (!exact(state, ["policy", "firstNight", "history"])) return undefined;
  const firstNight = field(state, "firstNight");
  if (field(state, "policy") !== WOLF_SORCERER_POLICY || (firstNight !== 1 && firstNight !== 2))
    return undefined;
  const history = arrayItems(field(state, "history"));
  if (!history) return undefined;
  let previous = 0;
  const used = new Set<number>();
  for (const entry of history) {
    if (!exact(entry, ["day", "pair"])) return undefined;
    const day = field(entry, "day"),
      rawPair = field(entry, "pair");
    if (!integer(day) || day < firstNight || day <= previous) return undefined;
    previous = day;
    if (rawPair === null) continue;
    const pair = arrayItems(rawPair);
    if (
      !pair ||
      pair.length !== 2 ||
      !integer(pair[0]) ||
      !integer(pair[1]) ||
      pair[0] >= pair[1] ||
      used.has(pair[0]) ||
      used.has(pair[1])
    )
      return undefined;
    used.add(pair[0]);
    used.add(pair[1]);
  }
  return state as WolfSorcererState;
}
export function createWolfSorcererState(firstNight: 1 | 2): WolfSorcererState {
  return { policy: WOLF_SORCERER_POLICY, firstNight, history: [] };
}
export function projectWolfSorcererState(
  role: RoleComponent | undefined,
): WolfSorcererState | undefined {
  const state = getWolfSorcererState(role);
  if (!state) return undefined;
  const history: WolfSorcererChoice[] = [];
  for (const row of arrayItems(field(state, "history"))!) {
    const rawPair = field(row, "pair");
    const values = rawPair === null ? null : arrayItems(rawPair)!;
    history.push({
      day: field(row, "day") as number,
      pair: values ? [values[0] as number, values[1] as number] : null,
    });
  }
  return {
    policy: WOLF_SORCERER_POLICY,
    firstNight: field(state, "firstNight") as 1 | 2,
    history,
  };
}
