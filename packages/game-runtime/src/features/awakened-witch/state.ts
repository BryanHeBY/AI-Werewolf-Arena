/**
 * 负责觉醒女巫唯一不可变历史槽的安装、读取和原引用替换。输入为原角色与已校验的下一夜历史，
 * 输出原状态或脱离投影；本模块不持请求、生命或第二份资源计数，库存由同一历史推导。
 * 仅自有普通数据槽可写，Proxy／访问器／重复安装拒绝；未付错误不写槽，已付前缀不退款。
 */
import { types } from "node:util";
import {
  AWAKENED_WITCH_POLICY,
  readAwakenedWitchStateData,
  type AwakenedWitchState,
  type AwakenedWitchNight,
} from "@ai-werewolf-arena/game-contract/facts/awakened-witch";
import type { RoleComponent } from "../../domain/components/role";
import { snapshotPlainData } from "../../domain/plain-data";

function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
/** 规范对象完全由严格副本构建；嵌套协作回执冻结，外部引用不能绕开原槽替换追加同意票。 */
function canonical(nights: readonly AwakenedWitchNight[]): AwakenedWitchState {
  const data = readAwakenedWitchStateData({ policy: AWAKENED_WITCH_POLICY, nights });
  if (!data) throw new Error("awakened_witch_history_invalid");
  return Object.freeze({
    policy: AWAKENED_WITCH_POLICY,
    nights: Object.freeze(
      data.nights.map((n) =>
        n.mode === "poison"
          ? Object.freeze({
              ...n,
              assistantIds: Object.freeze([...n.assistantIds]),
              discussions: Object.freeze(n.discussions.map((d) => Object.freeze({ ...d }))),
              approvals: Object.freeze(n.approvals.map((a) => Object.freeze({ ...a }))),
            })
          : Object.freeze({ ...n }),
      ),
    ),
  });
}

export function initializeAwakenedWitchState(role: RoleComponent): void {
  const container = own(role, "privateState");
  if (
    !container ||
    typeof container !== "object" ||
    types.isProxy(container) ||
    Object.getOwnPropertyDescriptor(container, "awakenedWitch") !== undefined
  )
    throw new Error("awakened_witch_install_invalid");
  Object.defineProperty(container, "awakenedWitch", {
    value: canonical([]),
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/** 原引用只供真实窗口的CAS复验；角色／World／生命权限由本族运行owner拥有，不凭历史恢复。 */
export function getAwakenedWitchState(
  role: RoleComponent | undefined,
): AwakenedWitchState | undefined {
  const data = own(own(role, "privateState"), "awakenedWitch");
  try {
    return readAwakenedWitchStateData(snapshotPlainData(data, new Set(), 0, 65536))
      ? (data as AwakenedWitchState)
      : undefined;
  } catch {
    return undefined;
  }
}

export function prepareAwakenedWitchState(
  nights: readonly AwakenedWitchNight[],
): AwakenedWitchState {
  return canonical(nights);
}

/** 只替换原自有可写属性；同形clone、容器访问器和换槽均拒绝，不向替身补装状态。 */
export function replaceAwakenedWitchState(
  role: RoleComponent,
  expected: AwakenedWitchState,
  next: AwakenedWitchState,
): void {
  const container = own(role, "privateState");
  if (!container || typeof container !== "object" || types.isProxy(container))
    throw new Error("awakened_witch_state_revoked");
  const descriptor = Object.getOwnPropertyDescriptor(container, "awakenedWitch");
  if (
    !descriptor ||
    !("value" in descriptor) ||
    descriptor.value !== expected ||
    descriptor.writable !== true
  )
    throw new Error("awakened_witch_state_revoked");
  Object.defineProperty(container, "awakenedWitch", { ...descriptor, value: next });
}
