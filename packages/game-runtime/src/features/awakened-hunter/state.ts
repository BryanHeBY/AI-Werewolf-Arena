/**
 * 负责觉醒猎人一个巡猎单位的唯一私态槽。输入为原Role与实际方向付款，输出同不可变状态；
 * 数据结构仅payment，空过也消费此唯一单位，不复制普通Hunter枪库存。安装身份由WeakMap保有，
 * 修改只经原槽CAS；观察到容器或槽替换即永久撤权，JSON／同形对象不能恢复付款权。
 */
import { types } from "node:util";
import {
  AWAKENED_PATROL_POLICY,
  readAwakenedPatrolStateData,
  type AwakenedPatrolState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-patrol";
import type { RoleComponent } from "../../domain/components/role";
import { snapshotPlainData } from "../../domain/plain-data";
interface Stock {
  readonly container: object;
  state: AwakenedPatrolState;
  revoked: boolean;
}
const stocks = new WeakMap<RoleComponent, Stock>();
const prepared = new WeakSet<AwakenedPatrolState>();
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
export function prepareAwakenedPatrolState(input: AwakenedPatrolState): AwakenedPatrolState {
  const value = readAwakenedPatrolStateData(snapshotPlainData(input, new Set(), 0, 65536));
  if (!value) throw new Error("awakened_patrol_state_invalid");
  const state = Object.freeze({
    policy: AWAKENED_PATROL_POLICY,
    payment: value.payment ? Object.freeze({ ...value.payment }) : null,
  });
  prepared.add(state);
  return state;
}
export function initializeAwakenedPatrolState(role: RoleComponent): void {
  const container = own(role, "privateState");
  if (
    stocks.has(role) ||
    !container ||
    typeof container !== "object" ||
    types.isProxy(container) ||
    Object.getOwnPropertyDescriptor(container, "awakenedPatrol")
  )
    throw new Error("awakened_patrol_state_install_invalid");
  const state = prepareAwakenedPatrolState({ policy: AWAKENED_PATROL_POLICY, payment: null });
  Object.defineProperty(container, "awakenedPatrol", {
    value: state,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  stocks.set(role, { container, state, revoked: false });
}
export function getAwakenedPatrolState(
  role: RoleComponent | undefined,
): AwakenedPatrolState | undefined {
  const stock = role && stocks.get(role);
  if (!stock || stock.revoked) return undefined;
  if (
    own(role, "privateState") !== stock.container ||
    own(stock.container, "awakenedPatrol") !== stock.state
  ) {
    stock.revoked = true;
    return undefined;
  }
  return stock.state;
}
export function replaceAwakenedPatrolState(
  role: RoleComponent,
  expected: AwakenedPatrolState,
  next: AwakenedPatrolState,
): void {
  const stock = stocks.get(role);
  if (!stock || getAwakenedPatrolState(role) !== expected)
    throw new Error("awakened_patrol_state_revoked");
  if (!prepared.has(next) || expected.payment !== null || next.payment === null)
    throw new Error("awakened_patrol_state_transition_invalid");
  const d = Object.getOwnPropertyDescriptor(stock.container, "awakenedPatrol");
  if (!d || !Object.hasOwn(d, "value") || !d.writable)
    throw new Error("awakened_patrol_state_revoked");
  Object.defineProperty(stock.container, "awakenedPatrol", { ...d, value: next });
  stock.state = next;
}
