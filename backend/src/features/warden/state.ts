/**
 * 负责典狱长唯一不可变私态槽。输入是原角色容器和已校验历史，输出同一槽引用或脱离副本。
 * 每人一次的参与资格只由真实历史推导，不保存used镜像；slot替换为唯一付款／回执写点。
 * 不接受Proxy、访问器或已存在槽，不向替换角色补装状态。
 * 数据结构为具名policy、forcePolicy和递增history；每项只保存pair、双方已付决定与resolved，不存并行used集合。
 */
import { types } from "node:util";
import {
  WARDEN_POLICY,
  WARDEN_FORCE_POLICY,
  readWardenStateData,
  type WardenNight,
  type WardenState,
} from "@ai-werewolf-arena/game-contract/facts/warden";
import type { RoleComponent } from "../../domain/components/role";
import { snapshotPlainData } from "../../domain/plain-data";
function own(v: unknown, k: string): unknown {
  if (!v || typeof v !== "object" || types.isProxy(v)) return undefined;
  const d = Object.getOwnPropertyDescriptor(v, k);
  return d && "value" in d ? d.value : undefined;
}
function canonical(history: readonly WardenNight[]): WardenState {
  const value = readWardenStateData({
    policy: WARDEN_POLICY,
    forcePolicy: WARDEN_FORCE_POLICY,
    history,
  });
  if (!value) throw new Error("warden_history_invalid");
  return Object.freeze({
    ...value,
    history: Object.freeze(
      value.history.map((r) =>
        Object.freeze({
          ...r,
          pair: r.pair ? Object.freeze([...r.pair] as [number, number]) : null,
          decisions: Object.freeze(r.decisions.map((d) => Object.freeze({ ...d }))),
        }),
      ),
    ),
  });
}
export function initializeWardenState(role: RoleComponent): void {
  const c = own(role, "privateState");
  if (
    !c ||
    typeof c !== "object" ||
    types.isProxy(c) ||
    Object.getOwnPropertyDescriptor(c, "warden")
  )
    throw new Error("warden_state_install_invalid");
  Object.defineProperty(c, "warden", {
    value: canonical([]),
    writable: true,
    configurable: true,
    enumerable: true,
  });
}
export function getWardenState(role: RoleComponent | undefined): WardenState | undefined {
  const s = own(own(role, "privateState"), "warden");
  try {
    return readWardenStateData(snapshotPlainData(s, new Set(), 0, 65536))
      ? (s as WardenState)
      : undefined;
  } catch {
    return undefined;
  }
}
export function prepareWardenHistory(history: readonly WardenNight[]): WardenState {
  return canonical(history);
}
export function replaceWardenState(
  role: RoleComponent,
  expected: WardenState,
  next: WardenState,
): void {
  const c = own(role, "privateState");
  if (!c || typeof c !== "object" || types.isProxy(c)) throw new Error("warden_state_revoked");
  const d = Object.getOwnPropertyDescriptor(c, "warden");
  if (!d || !("value" in d) || d.value !== expected || !d.writable)
    throw new Error("warden_state_revoked");
  Object.defineProperty(c, "warden", { ...d, value: next });
}
