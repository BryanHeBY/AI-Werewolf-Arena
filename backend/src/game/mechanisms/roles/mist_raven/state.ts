/**
 * 负责炼金魔女／狼鸦之爪的原严格数据读取、默认构造与选择／解封副本准备。
 * 输入为未知状态、日次和 caller 已计算的目标；输出为脱离可写副本或原具名错误，公共政策不变。
 * 本数据 owner 保持精确字段、剩余量／历史相关性和 Node Proxy 先拒绝；descriptor helper
 * 供状态绑定与参与者授权共同使用，不执行 getter、不保存库存或授予行动／原生命权限。
 */
import { types } from "node:util";

export function readMistOwnData(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}

export const MIST_RAVEN_POLICY = "awa_mist_raven_v1" as const;
/** 雾和蛇各有独立 0/1 库存；实际 select 的非 null 选择消费对应资源，跳过只留历史，不补库存。 */
export interface AlchemistState {
  policy: typeof MIST_RAVEN_POLICY;
  mistRemaining: 0 | 1;
  healRemaining: 0 | 1;
  mistHistory: Array<{ day: number; targetIds: number[] | null }>;
  healHistory: Array<{ day: number; targetId: number | null }>;
}
/** 满足存活狼少于三人的觉醒条件时，夜初首次记录觉醒日和当时已知同伴；后续保留知识而非当前存活名单；额外刀的 0/1 消费与历史独立于普通狼刀许可。 */
export interface RavenState {
  policy: typeof MIST_RAVEN_POLICY;
  awakenedDay: number | null;
  knownTeammateIds: number[];
  extraRemaining: 0 | 1;
  extraHistory: Array<{ day: number; targetId: number | null }>;
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value)) return;
  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
    value as object,
  );
  if (Reflect.ownKeys(descriptors).length !== keys.length) return;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const d = descriptors[key];
    if (!d || !("value" in d)) return;
    result[key] = d.value;
  }
  return result;
}
function items(value: unknown): unknown[] | undefined {
  if (types.isProxy(value) || !Array.isArray(value)) return;
  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
    value as object,
  );
  const length: unknown = descriptors.length?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(descriptors).length !== length + 1
  )
    return;
  const out: unknown[] = [];
  for (let n = 0; n < length; n++) {
    const d = descriptors[String(n)];
    if (!d || !("value" in d)) return;
    out.push(d.value);
  }
  return out;
}
function positive(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
function ids(value: unknown): number[] | undefined {
  const list = items(value);
  return list && list.every(positive) && new Set(list).size === list.length ? list : undefined;
}
function pointHistory(
  value: unknown,
  earliest: number,
): Array<{ day: number; targetId: number | null }> | undefined {
  const list = items(value);
  if (!list) return;
  const out: Array<{ day: number; targetId: number | null }> = [];
  let last = earliest - 1,
    spent = false;
  for (const item of list) {
    const r = record(item, ["day", "targetId"]);
    if (
      !r ||
      !positive(r.day) ||
      r.day <= last ||
      spent ||
      (r.targetId !== null && !positive(r.targetId))
    )
      return;
    out.push({ day: r.day, targetId: r.targetId as number | null });
    last = r.day;
    spent ||= r.targetId !== null;
  }
  return out;
}
export function createAlchemistState(): AlchemistState {
  return {
    policy: MIST_RAVEN_POLICY,
    mistRemaining: 1,
    healRemaining: 1,
    mistHistory: [],
    healHistory: [],
  };
}
export function readAlchemistState(value: unknown): AlchemistState | undefined {
  const r = record(value, [
    "policy",
    "mistRemaining",
    "healRemaining",
    "mistHistory",
    "healHistory",
  ]);
  if (!r || r.policy !== MIST_RAVEN_POLICY) return;
  const choices = items(r.mistHistory),
    heals = pointHistory(r.healHistory, 1);
  if (!choices || !heals) return;
  let last = 0,
    spent = false;
  const mistHistory: AlchemistState["mistHistory"] = [];
  for (const item of choices) {
    const c = record(item, ["day", "targetIds"]);
    if (!c || !positive(c.day) || c.day <= last || spent) return;
    const targets = c.targetIds === null ? null : ids(c.targetIds);
    if (targets !== null && (!targets || targets.length !== 3)) return;
    mistHistory.push({ day: c.day, targetIds: targets! });
    last = c.day;
    spent ||= targets !== null;
  }
  const mistRemaining = spent ? 0 : 1,
    healRemaining = heals.some((h) => h.targetId !== null) ? 0 : 1;
  if (r.mistRemaining !== mistRemaining || r.healRemaining !== healRemaining) return;
  return {
    policy: MIST_RAVEN_POLICY,
    mistRemaining,
    healRemaining,
    mistHistory,
    healHistory: heals,
  };
}
export function selectMist(
  state: AlchemistState,
  day: number,
  targetIds: number[] | null,
  livingIds: readonly number[],
): AlchemistState {
  const next = readAlchemistState(state),
    targets = targetIds === null ? null : ids(targetIds);
  if (
    !next ||
    next.mistRemaining !== 1 ||
    !positive(day) ||
    day <= (next.mistHistory.at(-1)?.day ?? 0)
  )
    throw new Error("mist_choice_unavailable");
  if (
    targets !== null &&
    (!targets || targets.length !== 3 || targets.some((id) => !livingIds.includes(id)))
  )
    throw new Error("mist_choice_target_invalid");
  next.mistHistory.push({ day, targetIds: targets! });
  if (targets !== null) next.mistRemaining = 0;
  return next;
}
/** legalTargets 已由原 pending 夜 owner 按原刀口、生命与自救规则计算；本函数不重新推断权限。 */
export function selectSnake(
  state: AlchemistState,
  day: number,
  targetId: number | null,
  legalTargets: readonly number[],
): AlchemistState {
  const next = readAlchemistState(state);
  if (
    !next ||
    next.healRemaining !== 1 ||
    !positive(day) ||
    day <= (next.healHistory.at(-1)?.day ?? 0)
  )
    throw new Error("snake_choice_unavailable");
  if (targetId !== null && (!positive(targetId) || !legalTargets.includes(targetId)))
    throw new Error("snake_choice_target_invalid");
  next.healHistory.push({ day, targetId });
  if (targetId !== null) next.healRemaining = 0;
  return next;
}
export function createRavenState(): RavenState {
  return {
    policy: MIST_RAVEN_POLICY,
    awakenedDay: null,
    knownTeammateIds: [],
    extraRemaining: 1,
    extraHistory: [],
  };
}
export function readRavenState(value: unknown): RavenState | undefined {
  const r = record(value, [
    "policy",
    "awakenedDay",
    "knownTeammateIds",
    "extraRemaining",
    "extraHistory",
  ]);
  if (!r || r.policy !== MIST_RAVEN_POLICY || (r.awakenedDay !== null && !positive(r.awakenedDay)))
    return;
  const known = ids(r.knownTeammateIds),
    history = pointHistory(r.extraHistory, (r.awakenedDay as number | null) ?? 1);
  if (
    !known ||
    known.length > 1 ||
    !history ||
    (r.awakenedDay === null && (known.length > 0 || history.length > 0))
  )
    return;
  const remaining = history.some((h) => h.targetId !== null) ? 0 : 1;
  if (r.extraRemaining !== remaining) return;
  return {
    policy: MIST_RAVEN_POLICY,
    awakenedDay: r.awakenedDay as number | null,
    knownTeammateIds: known,
    extraRemaining: remaining,
    extraHistory: history,
  };
}
/** 原开夜 owner 只调用一次；查询／白天变化不能解封，这里只准备独立 next 副本。 */
export function unsealRaven(
  state: RavenState,
  day: number,
  actorId: number,
  livingWolfIds: readonly number[],
): RavenState {
  const next = readRavenState(state);
  if (
    !next ||
    !positive(day) ||
    !positive(actorId) ||
    next.knownTeammateIds.includes(actorId) ||
    !livingWolfIds.includes(actorId) ||
    livingWolfIds.some((id) => !positive(id)) ||
    new Set(livingWolfIds).size !== livingWolfIds.length
  )
    throw new Error("raven_unseal_invalid");
  if (next.awakenedDay !== null) {
    if (day < next.awakenedDay) throw new Error("raven_unseal_invalid");
    return next;
  }
  if (livingWolfIds.length < 3) {
    next.awakenedDay = day;
    next.knownTeammateIds = livingWolfIds.filter((id) => id !== actorId).sort((a, b) => a - b);
  }
  return next;
}
export function selectRavenKnife(
  state: RavenState,
  day: number,
  actorId: number,
  targetId: number | null,
  livingIds: readonly number[],
): RavenState {
  const next = readRavenState(state);
  if (
    !next ||
    !positive(actorId) ||
    next.knownTeammateIds.includes(actorId) ||
    next.awakenedDay === null ||
    next.extraRemaining !== 1 ||
    !positive(day) ||
    day < next.awakenedDay ||
    day <= (next.extraHistory.at(-1)?.day ?? 0) ||
    !livingIds.includes(actorId)
  )
    throw new Error("raven_knife_unavailable");
  if (
    targetId !== null &&
    (!positive(targetId) || targetId === actorId || !livingIds.includes(targetId))
  )
    throw new Error("raven_knife_target_invalid");
  next.extraHistory.push({ day, targetId });
  if (targetId !== null) next.extraRemaining = 0;
  return next;
}
