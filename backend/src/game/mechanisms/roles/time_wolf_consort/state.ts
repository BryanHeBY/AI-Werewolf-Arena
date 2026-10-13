/**
 * 负责蚀时狼妃状态构造、原槽同引用读取、玩家知识裁剪和纯反射目标选择。
 * 输入为原角色／历史、日次与请求目标，输出为原状态引用、独立知识 DTO 或原目标决策。
 * 本数据 owner 保持 Node Proxy／描述符拒绝和精确形状；反射回执、实际状态写权与生命／
 * 请求权限仍归夜机制，数据检查和字段可写声明不提交效果或授予许可。
 */
import type {
  ReflectionScope,
  TimeConsortChoice,
  TimeConsortState,
  TimeConsortReadState,
} from "@ai-werewolf-arena/game-contract";
import type { PlayerTimeConsortState } from "@ai-werewolf-arena/game-contract/facts/time-consort";
import { types } from "node:util";
import { Camp, type RoleComponent } from "../../../../core";
export const TIME_CONSORT_ROLE = "time_wolf_consort" as const;
export const TIME_CONSORT_POLICY = "awa_time_consort_reflection_v1" as const;
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

export function getTimeConsortState(
  role: RoleComponent | undefined,
): TimeConsortReadState | undefined {
  if (field(role, "role") !== TIME_CONSORT_ROLE || field(role, "camp") !== Camp.Wolf)
    return undefined;
  const state = field(field(role, "privateState"), "timeConsort");
  if (!exact(state, ["policy", "reflectionScope", "history", "triggeredDay"])) return undefined;
  const scope = field(state, "reflectionScope"),
    trigger = field(state, "triggeredDay");
  if (
    field(state, "policy") !== TIME_CONSORT_POLICY ||
    (scope !== "whole_night" && scope !== "first_effect") ||
    (trigger !== null && !integer(trigger))
  )
    return undefined;
  const history = arrayItems(field(state, "history"));
  if (!history) return undefined;
  let previous = 0,
    previousTarget: number | null = null,
    triggerFound = trigger === null;
  for (const row of history) {
    if (!exact(row, ["day", "targetId"])) return undefined;
    const day = field(row, "day"),
      target = field(row, "targetId");
    if (
      !integer(day) ||
      day <= previous ||
      (target !== null && !integer(target)) ||
      (typeof trigger === "number" && day > trigger)
    )
      return undefined;
    if (target !== null && day === previous + 1 && target === previousTarget) return undefined;
    if (day === trigger) {
      if (target === null) return undefined;
      triggerFound = true;
    }
    previous = day;
    previousTarget = target as number | null;
  }
  if (!triggerFound) return undefined;
  return state as TimeConsortReadState;
}
export function createTimeConsortState(
  reflectionScope: ReflectionScope = "whole_night",
): TimeConsortState {
  return { policy: TIME_CONSORT_POLICY, reflectionScope, history: [], triggeredDay: null };
}
/** 自身知识投影：历史可见至观察 day，触发日严格早于 day 才告知耗尽。 */
export function projectTimeConsortState(
  role: RoleComponent | undefined,
  day: number,
): PlayerTimeConsortState | undefined {
  const state = getTimeConsortState(role);
  if (!state || !integer(day)) return undefined;
  const history: TimeConsortChoice[] = [];
  // 保留原 when<=day 的历史边界与逐行新副本；不能把耗尽的严格早于规则套到历史。
  for (const row of arrayItems(field(state, "history"))!) {
    const when = field(row, "day") as number;
    if (when > day) continue;
    history.push({ day: when, targetId: field(row, "targetId") as number | null });
  }
  const trigger = field(state, "triggeredDay") as number | null;
  return {
    policy: TIME_CONSORT_POLICY,
    reflectionScope: state.reflectionScope,
    history,
    exhausted: trigger !== null && trigger < day,
  };
}
/** 仅选择反射目标；真实效果归属、原体版本与付款／提交仍由夜回执复验。 */
export function timeConsortReflectionTarget(
  role: RoleComponent | undefined,
  day: number,
  sourceCamp: Camp,
  sourceId: number,
  requestedId: number,
  kind: string,
): number {
  if (!integer(day) || !integer(sourceId) || !integer(requestedId))
    throw new Error("time_consort_invalid_target");
  const state = getTimeConsortState(role);
  if (!state) throw new Error("time_consort_invalid_state");
  if (sourceCamp !== Camp.Good || !["check", "guard", "poison"].includes(kind)) return requestedId;
  const choice = arrayItems(field(state, "history"))!.find((h) => field(h, "day") === day);
  if (field(choice, "targetId") !== requestedId) return requestedId;
  if (
    state.triggeredDay !== null &&
    (state.triggeredDay !== day || state.reflectionScope === "first_effect")
  )
    return requestedId;
  return sourceId;
}
