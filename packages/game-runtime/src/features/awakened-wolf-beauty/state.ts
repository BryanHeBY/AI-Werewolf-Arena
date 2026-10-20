/**
 * 负责觉醒狼美人的唯一私态库存槽。输入为原Role和已校验的选择／替死receipt，输出原不可变状态；
 * 数据结构只持choices与唯一replacement，不存used、cooldown或活跃关系镜像。仅本安装器mint原槽身份，
 * 实际提交采用同状态CAS；访问器／Proxy／容器替换均撤权，不通过恢复旧JSON重建库存或复活许可。
 */
import { types } from "node:util";
import {
  AWAKENED_BEAUTY_POLICY,
  readAwakenedBeautyStateData,
  type AwakenedBeautyState,
} from "@ai-werewolf-arena/game-contract/facts/awakened-beauty";
import type { RoleComponent } from "../../domain/components/role";
import { snapshotPlainData } from "../../domain/plain-data";
interface Stock {
  readonly container: object;
  state: AwakenedBeautyState;
  revoked: boolean;
}
const stocks = new WeakMap<RoleComponent, Stock>();
const prepared = new WeakSet<AwakenedBeautyState>();
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
export function prepareAwakenedBeautyState(input: AwakenedBeautyState): AwakenedBeautyState {
  const value = readAwakenedBeautyStateData(snapshotPlainData(input, new Set(), 0, 65536));
  if (!value) throw new Error("awakened_beauty_state_invalid");
  const state = Object.freeze({
    policy: AWAKENED_BEAUTY_POLICY,
    choices: Object.freeze(value.choices.map((choice) => Object.freeze({ ...choice }))),
    replacement: value.replacement
      ? Object.freeze({
          ...value.replacement,
          preventedCauses: Object.freeze([...value.replacement.preventedCauses]),
        })
      : null,
  });
  prepared.add(state);
  return state;
}
export function initializeAwakenedBeautyState(role: RoleComponent): void {
  const container = own(role, "privateState");
  if (
    stocks.has(role) ||
    !container ||
    typeof container !== "object" ||
    types.isProxy(container) ||
    Object.getOwnPropertyDescriptor(container, "awakenedBeauty")
  )
    throw new Error("awakened_beauty_state_install_invalid");
  const state = prepareAwakenedBeautyState({
    policy: AWAKENED_BEAUTY_POLICY,
    choices: [],
    replacement: null,
  });
  Object.defineProperty(container, "awakenedBeauty", {
    value: state,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  stocks.set(role, { container, state, revoked: false });
}
export function getAwakenedBeautyState(
  role: RoleComponent | undefined,
): AwakenedBeautyState | undefined {
  const stock = role && stocks.get(role);
  if (!stock || stock.revoked) return undefined;
  if (
    own(role, "privateState") !== stock.container ||
    own(stock.container, "awakenedBeauty") !== stock.state
  ) {
    stock.revoked = true;
    return undefined;
  }
  return stock.state;
}
export function replaceAwakenedBeautyState(
  role: RoleComponent,
  expected: AwakenedBeautyState,
  next: AwakenedBeautyState,
): void {
  const stock = stocks.get(role);
  if (!stock || getAwakenedBeautyState(role) !== expected)
    throw new Error("awakened_beauty_state_revoked");
  if (!prepared.has(next)) throw new Error("awakened_beauty_state_transition_invalid");
  const prefixUnchanged = expected.choices.every(
    (choice, index) =>
      next.choices[index]?.day === choice.day && next.choices[index]?.targetId === choice.targetId,
  );
  if (
    expected.replacement !== null ||
    !prefixUnchanged ||
    (next.replacement === null
      ? next.choices.length !== expected.choices.length + 1
      : next.choices.length !== expected.choices.length)
  )
    throw new Error("awakened_beauty_state_transition_invalid");
  const d = Object.getOwnPropertyDescriptor(stock.container, "awakenedBeauty");
  if (!d || !Object.hasOwn(d, "value") || !d.writable)
    throw new Error("awakened_beauty_state_revoked");
  Object.defineProperty(stock.container, "awakenedBeauty", { ...d, value: next });
  stock.state = next;
}
