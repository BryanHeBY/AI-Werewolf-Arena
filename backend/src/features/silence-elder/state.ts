/**
 * 负责禁言长老私有数据槽的安装、同引用读取及唯一替换写权。
 * 输入为原角色和纯历史，输出原状态或脱离投影；数据只保存已提交选择，不保存可序列化的生命、请求或表达许可。
 * 每次读取先拒绝 Node Proxy／访问器，再核严格历史。写入只替换原数据属性，失败保留已发生前缀，不向替换角色补装状态。
 */
import { types } from "node:util";
import {
  SILENCE_ELDER_POLICY,
  SILENCE_ELDER_ROLE_ID,
  readSilenceElderStateData,
  type SilenceElderChoice,
  type SilenceElderState,
} from "@ai-werewolf-arena/game-contract/facts/silence-elder";
import type { RoleComponent } from "../../domain/components/role";
import { snapshotPlainData } from "../../domain/plain-data";

function own(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/** 冻结的规范状态由本槽构造；外部 readonly 视图不能靠修改同一 history 获得更多夜间选择。 */
function canonical(history: readonly SilenceElderChoice[]): SilenceElderState {
  return Object.freeze({
    policy: SILENCE_ELDER_POLICY,
    history: Object.freeze(history.map((row) => Object.freeze({ ...row }))),
  });
}

export function initializeSilenceElderState(role: RoleComponent): void {
  const container = own(role, "privateState");
  if (
    !container ||
    typeof container !== "object" ||
    types.isProxy(container) ||
    Object.getOwnPropertyDescriptor(container, "silenceElder") !== undefined
  )
    throw new Error("silence_elder_state_install_invalid");
  Object.defineProperty(container, "silenceElder", {
    value: canonical([]),
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/** 返回严格检查后的同一状态引用；角色／阵营／生命授权仍由实际窗口 owner 复核。 */
export function getSilenceElderState(
  role: RoleComponent | undefined,
): SilenceElderState | undefined {
  if (own(role, "role") !== SILENCE_ELDER_ROLE_ID) return undefined;
  const state = own(own(role, "privateState"), "silenceElder");
  try {
    return readSilenceElderStateData(snapshotPlainData(state, new Set(), 0, 65536))
      ? (state as SilenceElderState)
      : undefined;
  } catch {
    return undefined;
  }
}

export function projectSilenceElderState(
  role: RoleComponent | undefined,
): SilenceElderState | null {
  const state = getSilenceElderState(role);
  return state ? readSilenceElderStateData(state) : null;
}

/** 准备下一状态只接收已校验值，不写 live 槽；最早期限和原生命必须由调用方在实际替换前终验。 */
export function nextSilenceElderChoice(
  state: SilenceElderState,
  choice: SilenceElderChoice,
): SilenceElderState {
  const next = readSilenceElderStateData({
    policy: SILENCE_ELDER_POLICY,
    history: [...state.history, choice],
  });
  if (!next) throw new Error("silence_elder_choice_history_invalid");
  return canonical(next.history);
}

/** 真实窗口持有 expected；同形新对象不能替代原槽。此处不消费次数、不创建任何请求许可。 */
export function replaceSilenceElderState(
  role: RoleComponent,
  expected: SilenceElderState,
  next: SilenceElderState,
): void {
  const container = own(role, "privateState");
  if (!container || typeof container !== "object" || types.isProxy(container))
    throw new Error("silence_elder_state_revoked");
  const descriptor = Object.getOwnPropertyDescriptor(container, "silenceElder");
  if (
    !descriptor ||
    !("value" in descriptor) ||
    descriptor.value !== expected ||
    descriptor.writable !== true
  )
    throw new Error("silence_elder_state_revoked");
  // 先前 guard 已核原容器；只有普通自身数据属性可在此同步替换，不调用未知 setter 或写入外部新槽。
  Object.defineProperty(container, "silenceElder", { ...descriptor, value: next });
}
