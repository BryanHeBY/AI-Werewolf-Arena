import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../core";
export const TRICKSTER_ROLE = "trickster" as const;
export const TRICKSTER_POLICY = "awa_trickster_exile_v1" as const;
export interface TricksterChoice {
  day: number;
  pair: [number, number] | null;
}
export interface TricksterState {
  policy: typeof TRICKSTER_POLICY;
  history: TricksterChoice[];
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
export function getTricksterState(role: RoleComponent | undefined): TricksterState | undefined {
  if (field(role, "role") !== TRICKSTER_ROLE || field(role, "camp") !== Camp.Wolf) return undefined;
  const state = field(field(role, "privateState"), "trickster");
  if (!exact(state, ["policy", "history"])) return undefined;
  if (field(state, "policy") !== TRICKSTER_POLICY) return undefined;
  const history = arrayItems(field(state, "history"));
  if (!history) return undefined;
  let previous = 0;
  let previousPass = false;
  const used = new Set<number>();
  for (const entry of history) {
    if (!exact(entry, ["day", "pair"])) return undefined;
    const day = field(entry, "day"),
      rawPair = field(entry, "pair");
    if (!integer(day) || day <= previous) return undefined;
    if (rawPair === null && previousPass && day === previous + 1) return undefined;
    previous = day;
    previousPass = rawPair === null;
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
  return state as TricksterState;
}
export function createTricksterState(): TricksterState {
  return { policy: TRICKSTER_POLICY, history: [] };
}
export function projectTricksterState(role: RoleComponent | undefined): TricksterState | undefined {
  const state = getTricksterState(role);
  if (!state) return undefined;
  const history: TricksterChoice[] = [];
  for (const row of arrayItems(field(state, "history"))!) {
    const rawPair = field(row, "pair");
    const values = rawPair === null ? null : arrayItems(rawPair)!;
    history.push({
      day: field(row, "day") as number,
      pair: values ? [values[0] as number, values[1] as number] : null,
    });
  }
  return {
    policy: TRICKSTER_POLICY,
    history,
  };
}

/** Return a detached next state; the caller commits only after authority/life validation. */
export function nextTricksterChoice(
  role: RoleComponent | undefined,
  day: number,
  pair: readonly [number, number] | null,
  legalIds: readonly number[],
): TricksterState {
  const state = projectTricksterState(role);
  if (!state || !integer(day) || day <= (state.history.at(-1)?.day ?? 0))
    throw new Error("trickster_choice_invalid");
  if (pair === null) {
    const last = state.history.at(-1);
    if (last?.pair === null && last.day === day - 1) throw new Error("trickster_consecutive_pass");
    return { ...state, history: [...state.history, { day, pair: null }] };
  }
  const values = arrayItems(pair);
  if (
    !values ||
    values.length !== 2 ||
    !integer(values[0]) ||
    !integer(values[1]) ||
    values[0] === values[1]
  )
    throw new Error("trickster_target_invalid");
  const used = new Set(state.history.flatMap((row) => row.pair ?? []));
  if (values.some((id) => used.has(id as number) || !legalIds.includes(id as number)))
    throw new Error("trickster_target_invalid");
  const a = values[0],
    b = values[1];
  return { ...state, history: [...state.history, { day, pair: a < b ? [a, b] : [b, a] }] };
}
