/**
 * 负责觉醒狼美人的惰性选择历史与一次替死库存格式。输入为纯数据，输出严格脱离副本；
 * 冷却从真实非空选择推导、once从唯一替死receipt推导，不保存第二份可用次数或活跃关系镜像。
 * 本模块不确认付款或死亡；运行原体与提案凭证由本族owner保有，JSON不能恢复替死许可。
 */
import { copyEventData } from "../inert-event-data";
import { DeathCause } from "../death-facts";
import { Phase } from "../identity";

export const AWAKENED_BEAUTY_POLICY = "awa_awakened_replacement_v1" as const;
export interface AwakenedCharmChoice {
  readonly day: number;
  readonly targetId: number | null;
}
export interface AwakenedBeautyPayment {
  readonly day: number;
  readonly phase: Phase;
  readonly rootPhase: Phase;
  readonly targetId: number;
  readonly preventedCauses: readonly DeathCause[];
}
export interface AwakenedBeautyState {
  readonly policy: typeof AWAKENED_BEAUTY_POLICY;
  readonly choices: readonly AwakenedCharmChoice[];
  readonly replacement: AwakenedBeautyPayment | null;
}
/** 本人观察仅包含已选目标与资源是否已付，不带God原伤害/执行根或内部替死receipt。 */
export interface AwakenedBeautyKnowledge {
  readonly policy: typeof AWAKENED_BEAUTY_POLICY;
  readonly choices: readonly AwakenedCharmChoice[];
  readonly replacementUsed: boolean;
}
type BeautyBase = { policy: typeof AWAKENED_BEAUTY_POLICY; day: number; actorId: number };
export interface AwakenedBeautyPayloadMap {
  awakened_charm_chosen: BeautyBase & { targetId: number | null; nextAllowedNight: number };
  awakened_beauty_replacement_paid: BeautyBase & {
    targetId: number;
    phase: Phase;
    rootPhase: Phase;
    preventedCauses: readonly DeathCause[];
  };
  awakened_beauty_replaced: BeautyBase & { targetId: number; targetDied: boolean };
}
export const AWAKENED_BEAUTY_EVENT_TYPES = Object.freeze([
  "awakened_charm_chosen",
  "awakened_beauty_replacement_paid",
  "awakened_beauty_replaced",
] as const);
export type AwakenedBeautyFact = {
  [K in keyof AwakenedBeautyPayloadMap]: { type: K; payload: AwakenedBeautyPayloadMap[K] };
}[keyof AwakenedBeautyPayloadMap];

const id = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
function exact(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((key) => Object.hasOwn(v, key))
  );
}
const phase = (v: unknown): v is Phase =>
  v === Phase.Night || v === Phase.Day || v === Phase.Voting;

export function readAwakenedBeautyStateData(input: unknown): AwakenedBeautyState | null {
  try {
    const value = copyEventData(input, 1000);
    if (
      !exact(value, ["policy", "choices", "replacement"]) ||
      value.policy !== AWAKENED_BEAUTY_POLICY ||
      !Array.isArray(value.choices)
    )
      return null;
    let previousDay = 0,
      lastNonEmptyDay = 0;
    for (const choice of value.choices) {
      if (
        !exact(choice, ["day", "targetId"]) ||
        !id(choice.day) ||
        choice.day <= previousDay ||
        (lastNonEmptyDay > 0 && choice.day < lastNonEmptyDay + 2) ||
        !(choice.targetId === null || id(choice.targetId))
      )
        return null;
      previousDay = choice.day;
      if (choice.targetId !== null) lastNonEmptyDay = choice.day;
    }
    const paid = value.replacement;
    if (paid !== null) {
      const choice = value.choices.at(-1);
      if (
        !exact(paid, ["day", "phase", "rootPhase", "targetId", "preventedCauses"]) ||
        !id(paid.day) ||
        !phase(paid.phase) ||
        !phase(paid.rootPhase) ||
        !id(paid.targetId) ||
        !Array.isArray(paid.preventedCauses) ||
        paid.preventedCauses.length === 0 ||
        new Set(paid.preventedCauses).size !== paid.preventedCauses.length ||
        !paid.preventedCauses.every((cause) =>
          Object.values(DeathCause).includes(cause as DeathCause),
        ) ||
        !exact(choice, ["day", "targetId"]) ||
        choice.day !== paid.day ||
        choice.targetId !== paid.targetId
      )
        return null;
    }
    return value as unknown as AwakenedBeautyState;
  } catch {
    return null;
  }
}
export function readAwakenedBeautyFact(type: string, input: unknown): AwakenedBeautyFact | null {
  try {
    const p = copyEventData(input);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const value = p as Record<string, unknown>;
    if (value.policy !== AWAKENED_BEAUTY_POLICY || !id(value.day) || !id(value.actorId))
      return null;
    if (type === "awakened_charm_chosen") {
      if (
        !exact(value, ["policy", "day", "actorId", "targetId", "nextAllowedNight"]) ||
        !(value.targetId === null || (id(value.targetId) && value.targetId !== value.actorId)) ||
        value.nextAllowedNight !== value.day + (value.targetId === null ? 1 : 2)
      )
        return null;
    } else if (type === "awakened_beauty_replacement_paid") {
      if (
        !exact(value, [
          "policy",
          "day",
          "actorId",
          "targetId",
          "phase",
          "rootPhase",
          "preventedCauses",
        ]) ||
        !id(value.targetId) ||
        value.targetId === value.actorId ||
        !phase(value.phase) ||
        !phase(value.rootPhase) ||
        !Array.isArray(value.preventedCauses) ||
        !value.preventedCauses.length ||
        new Set(value.preventedCauses).size !== value.preventedCauses.length ||
        !value.preventedCauses.every((cause) =>
          Object.values(DeathCause).includes(cause as DeathCause),
        )
      )
        return null;
    } else if (type === "awakened_beauty_replaced") {
      if (
        !exact(value, ["policy", "day", "actorId", "targetId", "targetDied"]) ||
        !id(value.targetId) ||
        value.targetId === value.actorId ||
        typeof value.targetDied !== "boolean"
      )
        return null;
    } else return null;
    return { type, payload: value } as AwakenedBeautyFact;
  } catch {
    return null;
  }
}
