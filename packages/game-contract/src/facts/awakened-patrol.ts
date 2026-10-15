/**
 * 负责觉醒猎人唯一巡猎单位的纯receipt结构。输入为惰性数据，输出严格脱离副本；
 * direction和真实目标只描述已经付款的结果，不授予方向选择、真实阵营查询或死亡提案权限。
 * null库存表示尚无付款；明确空过同时保存null方向／目标，不把missing或迟到写成空过。
 */
import { copyEventData } from "../inert-event-data";
import { Phase } from "../identity";
export const AWAKENED_PATROL_POLICY = "awa_directional_patrol_v1" as const;
export type PatrolDirection = "clockwise" | "counter_clockwise";
export interface AwakenedPatrolPayment {
  readonly day: number;
  readonly rootPhase: Phase;
  readonly direction: PatrolDirection | null;
  readonly targetId: number | null;
}
export interface AwakenedPatrolState {
  readonly policy: typeof AWAKENED_PATROL_POLICY;
  readonly payment: AwakenedPatrolPayment | null;
}
type PatrolBase = { policy: typeof AWAKENED_PATROL_POLICY; day: number; actorId: number };
export interface AwakenedPatrolPayloadMap {
  awakened_patrol_paid: PatrolBase & {
    rootPhase: Phase;
    direction: PatrolDirection | null;
    targetId: number | null;
  };
  awakened_patrol_resolved: PatrolBase & {
    direction: PatrolDirection | null;
    targetId: number | null;
  };
}
export const AWAKENED_PATROL_EVENT_TYPES = Object.freeze([
  "awakened_patrol_paid",
  "awakened_patrol_resolved",
] as const);
export type AwakenedPatrolFact = {
  [K in keyof AwakenedPatrolPayloadMap]: { type: K; payload: AwakenedPatrolPayloadMap[K] };
}[keyof AwakenedPatrolPayloadMap];
function exact(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((key) => Object.hasOwn(v, key))
  );
}
export function readAwakenedPatrolStateData(input: unknown): AwakenedPatrolState | null {
  try {
    const value = copyEventData(input);
    if (!exact(value, ["policy", "payment"]) || value.policy !== AWAKENED_PATROL_POLICY)
      return null;
    const paid = value.payment;
    if (
      paid !== null &&
      (!exact(paid, ["day", "rootPhase", "direction", "targetId"]) ||
        typeof paid.day !== "number" ||
        !Number.isSafeInteger(paid.day) ||
        paid.day < 1 ||
        ![Phase.Night, Phase.Day, Phase.Voting].includes(paid.rootPhase as Phase) ||
        (paid.direction === null
          ? paid.targetId !== null
          : !["clockwise", "counter_clockwise"].includes(paid.direction as string) ||
            typeof paid.targetId !== "number" ||
            !Number.isSafeInteger(paid.targetId) ||
            paid.targetId < 1))
    )
      return null;
    return value as unknown as AwakenedPatrolState;
  } catch {
    return null;
  }
}
export function readAwakenedPatrolFact(type: string, input: unknown): AwakenedPatrolFact | null {
  try {
    const p = copyEventData(input);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const value = p as Record<string, unknown>;
    if (
      value.policy !== AWAKENED_PATROL_POLICY ||
      typeof value.day !== "number" ||
      !Number.isSafeInteger(value.day) ||
      value.day < 1 ||
      typeof value.actorId !== "number" ||
      !Number.isSafeInteger(value.actorId) ||
      value.actorId < 1 ||
      !(
        value.direction === null ||
        value.direction === "clockwise" ||
        value.direction === "counter_clockwise"
      ) ||
      !(
        value.targetId === null ||
        (typeof value.targetId === "number" &&
          Number.isSafeInteger(value.targetId) &&
          value.targetId > 0 &&
          value.targetId !== value.actorId)
      ) ||
      (value.direction === null && value.targetId !== null)
    )
      return null;
    if (type === "awakened_patrol_paid") {
      if (
        !exact(value, ["policy", "day", "actorId", "rootPhase", "direction", "targetId"]) ||
        ![Phase.Night, Phase.Day, Phase.Voting].includes(value.rootPhase as Phase) ||
        (value.direction !== null && value.targetId === null)
      )
        return null;
    } else if (type === "awakened_patrol_resolved") {
      if (!exact(value, ["policy", "day", "actorId", "direction", "targetId"])) return null;
    } else return null;
    return { type, payload: value } as AwakenedPatrolFact;
  } catch {
    return null;
  }
}
