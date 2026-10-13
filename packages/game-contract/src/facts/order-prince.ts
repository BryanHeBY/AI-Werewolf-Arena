/**
 * 负责定序王子的重投／选择事实 reader 与公共状态结构。输入为事件类型和无 reviver 的
 * JSON.parse 或已确认 inert 数据；输出为脱离事实／null，纯类型保留原可写选择 history。
 * 公共数据 owner 不读取 World、安装状态、授权重投或拥有 pending 选择；校验保持原字段、
 * 可空值与 ID 接受边界。浏览器反射可能触发 Proxy trap，恶意对象拒绝仍归 Node 准入。
 */
import { copyEventData } from "../inert-event-data";

/** 可写的自身选择知识／状态结构；是否能开启或提交重投仍由原权威检查。 */
export interface OrderPrinceChoice {
  day: number;
  activate: boolean;
}
export interface OrderPrinceState {
  policy: "awa_order_prince_first_ballot_v1";
  history: OrderPrinceChoice[];
}

export interface OrderPrinceRevoteFact {
  actorId: number;
}
export function readOrderPrinceRevoteFact(
  type: string,
  payload: unknown,
): OrderPrinceRevoteFact | null {
  if (type !== "order_prince_revote_started") return null;
  try {
    const p = copyEventData(payload);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const row = p as Record<string, unknown>;
    return Object.keys(row).length === 1 &&
      Object.hasOwn(row, "actorId") &&
      typeof row.actorId === "number" &&
      Number.isSafeInteger(row.actorId) &&
      row.actorId > 0 &&
      row.actorId < Number.MAX_SAFE_INTEGER
      ? { actorId: row.actorId }
      : null;
  } catch {
    return null;
  }
}

export interface OrderPrinceChoiceFact {
  actorId: number;
  day: number;
  activate: boolean;
}
export function readOrderPrinceChoiceFact(
  type: string,
  payload: unknown,
): OrderPrinceChoiceFact | null {
  if (type !== "order_prince_choice_committed") return null;
  try {
    const p = copyEventData(payload);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const row = p as Record<string, unknown>;
    const positive = (n: unknown) =>
      typeof n === "number" && Number.isSafeInteger(n) && n > 0 && n < Number.MAX_SAFE_INTEGER;
    return Object.keys(row).length === 3 &&
      ["actorId", "day", "activate"].every((k) => Object.hasOwn(row, k)) &&
      positive(row.actorId) &&
      positive(row.day) &&
      typeof row.activate === "boolean"
      ? { actorId: row.actorId as number, day: row.day as number, activate: row.activate }
      : null;
  } catch {
    return null;
  }
}
