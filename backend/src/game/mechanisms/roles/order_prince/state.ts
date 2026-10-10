import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../core";

export const ORDER_PRINCE_ROLE = "order_prince" as const;
export const ORDER_PRINCE_POLICY = "awa_order_prince_first_ballot_v1" as const;
export interface OrderPrinceChoice {
  day: number;
  activate: boolean;
}
export interface OrderPrinceState {
  policy: typeof ORDER_PRINCE_POLICY;
  history: OrderPrinceChoice[];
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
    keys.every((key) => descriptors[key] && "value" in descriptors[key]!)
  );
}
function dayNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
function rows(value: unknown): unknown[] | undefined {
  if (types.isProxy(value) || !Array.isArray(value)) return undefined;
  const length = field(value, "length");
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== length + 1) return undefined;
  const result: unknown[] = [];
  for (let i = 0; i < length; i++) {
    const d = descriptors[String(i)];
    if (!d || !("value" in d)) return undefined;
    result.push(d.value);
  }
  return result;
}
/** Read the original role state without invoking accessors or proxy traps. */
export function getOrderPrinceState(role: RoleComponent | undefined): OrderPrinceState | undefined {
  if (field(role, "role") !== ORDER_PRINCE_ROLE || field(role, "camp") !== Camp.Good)
    return undefined;
  const state = field(field(role, "privateState"), "orderPrince");
  if (!exact(state, ["policy", "history"]) || field(state, "policy") !== ORDER_PRINCE_POLICY)
    return undefined;
  const history = rows(field(state, "history"));
  if (!history) return undefined;
  let previous = 0;
  let consumed = false;
  for (const row of history) {
    if (!exact(row, ["day", "activate"])) return undefined;
    const day = field(row, "day");
    const activate = field(row, "activate");
    if (!dayNumber(day) || day <= previous || typeof activate !== "boolean" || consumed)
      return undefined;
    previous = day;
    consumed = activate;
  }
  return state as OrderPrinceState;
}
export function createOrderPrinceState(): OrderPrinceState {
  return { policy: ORDER_PRINCE_POLICY, history: [] };
}
export function projectOrderPrinceState(
  role: RoleComponent | undefined,
): OrderPrinceState | undefined {
  const state = getOrderPrinceState(role);
  if (!state) return undefined;
  const history: OrderPrinceChoice[] = [];
  for (const row of rows(field(state, "history"))!) {
    history.push({
      day: field(row, "day") as number,
      activate: field(row, "activate") as boolean,
    });
  }
  return { policy: ORDER_PRINCE_POLICY, history };
}
/** A detached next state; the caller commits it only after current-life checks. */
export function nextOrderPrinceChoice(
  role: RoleComponent | undefined,
  day: number,
  activate: boolean,
): OrderPrinceState | undefined {
  const state = projectOrderPrinceState(role);
  if (!state || !dayNumber(day) || typeof activate !== "boolean") return undefined;
  const last = state.history.at(-1);
  if (last && (last.activate || last.day >= day)) return undefined;
  state.history.push({ day, activate });
  return state;
}
