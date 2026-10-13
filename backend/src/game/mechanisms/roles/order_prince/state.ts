/**
 * 负责定序王子原状态读取、初始构造、脱离历史投影与下一选择数据准备。
 * 输入为原角色、观察／选择日和 activate；输出为原槽同引用或独立可写数据，不提交效果。
 * 公共字段结构归 GC facts/order-prince；本 owner 保持原精确描述符／Proxy 拒绝与历史顺序，
 * 真实 pending、原生命和写权仍由 authority 持有，准备副本不授予重投权限。
 */
import type { OrderPrinceChoice, OrderPrinceState } from "@ai-werewolf-arena/game-contract/facts/order-prince";
import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../core";

export const ORDER_PRINCE_ROLE = "order_prince" as const;
export const ORDER_PRINCE_POLICY = "awa_order_prince_first_ballot_v1" as const;
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
/** 按原 own data descriptor 检查原槽；Node Proxy 先拒绝，成功返回同一原状态引用。 */
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
  // 每行重新构造，保持原可写历史数组；调用者修改该知识不会改写原槽。
  const history: OrderPrinceChoice[] = [];
  for (const row of rows(field(state, "history"))!) {
    history.push({
      day: field(row, "day") as number,
      activate: field(row, "activate") as boolean,
    });
  }
  return { policy: ORDER_PRINCE_POLICY, history };
}
/** 准备独立下一状态；原 caller 重验 pending 与原生命后才提交，不写 live 槽。 */
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
