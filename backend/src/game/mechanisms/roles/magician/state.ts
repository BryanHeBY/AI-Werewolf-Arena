/**
 * Owns Magician state construction, exact live reads and detached player projection.
 * Inputs are original role/history data; outputs retain existing descriptor, day and pair
 * validation. This boundary never exchanges an effect, commits history or closes a frame.
 */
import type {
  MagicianChoice,
  MagicianState,
  MagicianReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../core";
export const MAGICIAN_ROLE = "magician" as const;
export const MAGICIAN_POLICY = "awa_magician_wolf_king_v1" as const;
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
export function getMagicianState(role: RoleComponent | undefined): MagicianReadState | undefined {
  if (field(role, "role") !== MAGICIAN_ROLE || field(role, "camp") !== Camp.Good) return undefined;
  const state = field(field(role, "privateState"), "magician");
  if (!exact(state, ["policy", "firstNight", "deathShotTargetPolicy", "history"])) return undefined;
  const firstNight = field(state, "firstNight");
  if (field(state, "policy") !== MAGICIAN_POLICY || (firstNight !== 1 && firstNight !== 2))
    return undefined;
  const shot = field(state, "deathShotTargetPolicy");
  if (shot !== "original" && shot !== "exchanged") return undefined;
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
  return state as MagicianReadState;
}
export function createMagicianState(
  firstNight: 1 | 2,
  deathShotTargetPolicy: "original" | "exchanged" = "original",
): MagicianState {
  return { policy: MAGICIAN_POLICY, firstNight, deathShotTargetPolicy, history: [] };
}
export function projectMagicianState(role: RoleComponent | undefined): MagicianState | undefined {
  const state = getMagicianState(role);
  if (!state) return undefined;
  const history: MagicianChoice[] = [];
  for (const row of arrayItems(field(state, "history"))!) {
    const rawPair = field(row, "pair");
    const values = rawPair === null ? null : arrayItems(rawPair)!;
    history.push({
      day: field(row, "day") as number,
      pair: values ? [values[0] as number, values[1] as number] : null,
    });
  }
  return {
    policy: MAGICIAN_POLICY,
    firstNight: field(state, "firstNight") as 1 | 2,
    deathShotTargetPolicy: field(state, "deathShotTargetPolicy") as "original" | "exchanged",
    history,
  };
}
