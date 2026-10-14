/**
 * 负责定序王子唯一数据槽的原构造、完整 live 校验、同引用读取、知识／下一状态准备与数据写入编码。
 * 输入为原角色、日次／activate和晚读容器，输出为原状态、独立可写副本或原明确拒绝。
 * Node Proxy、精确自身数据 descriptor、日期递增和首次激活后终止的政策保持；不新增严格接受条件。
 * 初始安装与同引用 replacement 由本槽执行，原体、身份、生命、pending与提交许可仍归 authority。
 * JSON仅为原 expected 比较；赋值／编码失败保留已写前缀，不回滚资源或建立第二份状态。
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
  // 原历史日次严格递增；明确放弃仍可继续，出现首次 activate=true 后不允许后续记录。
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

/** 原初始化先读赋值左侧容器，再调用无参create／setter；失败不补写或回滚。 */
function installOrderPrinceState(privateState: () => Record<string, unknown>): void {
  privateState().orderPrince = createOrderPrinceState();
}

/** authority已完成原准入；此处保原容器receiver和next引用，不复制、再校验或提前编码。 */
function replaceOrderPrinceState(
  privateState: () => RoleComponent["privateState"],
  next: OrderPrinceState,
): void {
  (privateState() as { orderPrince: OrderPrinceState }).orderPrince = next;
}

/** 先查JSON.stringify callee，再晚读原role／投影；不增加undefined拒绝或把知识数据当权限。 */
function encodeOrderPrinceProjection(role: () => RoleComponent | undefined): string {
  return JSON.stringify(projectOrderPrinceState(role()));
}

/** 原next比对：authority先替换槽及绑定引用，再查JSON.stringify；错误保留前缀，不替代档案codec。 */
function encodeOrderPrinceNext(next: OrderPrinceState): string {
  return JSON.stringify(next);
}

/**
 * 唯一数据程序表：schema/get保同一原校验，next只准备独立副本；allowedWrites仅执行原槽替换。
 * 表冻结不深冻结原状态／知识；authority仍按原序更新b.state、expected和pending，不经数据表授予重投许可。
 */
export const ORDER_PRINCE_STATE_SLOT = Object.freeze({
  create: createOrderPrinceState,
  schema: getOrderPrinceState,
  get: getOrderPrinceState,
  project: projectOrderPrinceState,
  next: nextOrderPrinceChoice,
  install: installOrderPrinceState,
  allowedWrites: Object.freeze({ replace: replaceOrderPrinceState }),
  checkpoint: Object.freeze({ projection: encodeOrderPrinceProjection, next: encodeOrderPrinceNext }),
});
