/**
 * 负责蚀时狼妃唯一状态槽的创建、完整 live 校验、同引用读取、初始化／历史／触发写入和身份编码。
 * 输入为原角色、范围参数、日次与晚读容器；输出为原状态、脱离知识副本或原明确拒绝。
 * Node Proxy／自身数据 descriptor、历史日期、重复目标和触发关联保持原政策；写入失败保留已写前缀。
 * frame 独自拥有原体、生命、能力、夜回执及 expectedState；槽不另存镜像、付款、开启窗口或授予许可。
 * 内部 JSON 只用于原运行比对，不是严格档案 codec；玩家历史可见至 day，耗尽只在触发日之后告知。
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

/** 完整原 live 校验先拒绝 Proxy，再读自身数据 descriptor；合法时保原状态／历史引用，不复制或冻结库存。 */
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
  // 日期严格递增，连续夜不能重复同一非空目标；触发必须对应非空选择且其后不能再有历史。
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

/** 原初始化先取赋值左侧容器，再取范围参数和 create；setter 或创建失败不补写／回滚。 */
function installTimeConsortState(
  privateState: () => Record<string, unknown>,
  value: { reflectionScope: ReflectionScope },
): void {
  privateState().timeConsort = createTimeConsortState(value.reflectionScope);
}

/** frame 先完成原准入；这里先取 defineProperty callee，再两次晚读原 state／history，保 index 与 descriptor。 */
function appendTimeConsortHistory(
  state: () => TimeConsortReadState,
  day: number,
  targetId: number | null,
): void {
  Object.defineProperty(state().history, String(state().history.length), {
    value: { day, targetId },
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** 原回执先标 used，再写触发日；setter 失败不恢复凭证，revision 和 expectedState 仍由 frame 随后更新。 */
function triggerTimeConsortState(state: () => TimeConsortReadState, day: number): void {
  (state() as Pick<TimeConsortState, "triggeredDay">).triggeredDay = day;
}

/** 原身份比对先投影／拒绝，再读取 JSON.stringify 与触发日；不替代归档格式或回执权限。 */
function encodeTimeConsortStateIdentity(role: RoleComponent): string {
  const view = projectTimeConsortState(role, Number.MAX_SAFE_INTEGER - 1);
  if (!view) throw new Error("time_consort_original_state_revoked");
  return JSON.stringify({ ...view, triggeredDay: getTimeConsortState(role)!.triggeredDay });
}
/**
 * 本族唯一槽的方法表。schema/get 使用同一完整原校验，allowedWrites 收走原两项写入，
 * 原状态可写性及引用保持；冻结方法表不深冻结状态。expectedState、revision、targetId、
 * committed 与 used 仍只由 frame 在原时点更新，读取或知识耗尽不授予反射付款许可。
 */
export const TIME_CONSORT_STATE_SLOT = Object.freeze({
  create: createTimeConsortState,
  schema: getTimeConsortState,
  get: getTimeConsortState,
  project: projectTimeConsortState,
  reflectionTarget: timeConsortReflectionTarget,
  install: installTimeConsortState,
  allowedWrites: Object.freeze({ appendHistory: appendTimeConsortHistory, trigger: triggerTimeConsortState }),
  checkpoint: Object.freeze({ identity: encodeTimeConsortStateIdentity }),
});
