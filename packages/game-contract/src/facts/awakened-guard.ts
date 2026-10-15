/**
 * 负责觉醒守卫周期的纯历史结构。输入为未知JSON，输出严格脱离副本；周期开夜一次、相邻单位禁连守。
 * 每行只有一个结果，保护回执与次数同属这份历史，不持World、原生命、执行回调或第二份可用库存。
 * open仅可出现于最后一单位，wait不写资源历史；具体夜／白天边界和付款权仍归运行所有者。
 */
import { copyEventData } from "../inert-event-data";
import { Phase, ActionWindow } from "../identity";
import { DeathCause } from "../death-facts";
export const AWAKENED_GUARD_ROLE_ID = "awakened_guard" as const;
export const AWAKENED_GUARD_POLICY = "awa_awakened_guard_cycle_v1" as const;
export type AwakenedGuardCycle =
  | { readonly day: number; readonly status: "open" | "passed" | "unused" }
  | {
      readonly day: number;
      readonly status: "protected";
      readonly targetId: number;
      readonly timing: "night" | "day";
    };
export interface AwakenedGuardState {
  readonly policy: typeof AWAKENED_GUARD_POLICY;
  readonly cycles: readonly AwakenedGuardCycle[];
}
function exact(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k))
  );
}
const id = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0;
export function readAwakenedGuardStateData(value: unknown): AwakenedGuardState | null {
  let v: unknown;
  try {
    v = copyEventData(value, 1000);
  } catch {
    return null;
  }
  if (
    !exact(v, ["policy", "cycles"]) ||
    v.policy !== AWAKENED_GUARD_POLICY ||
    !Array.isArray(v.cycles)
  )
    return null;
  for (let i = 0; i < v.cycles.length; i++) {
    const c = v.cycles[i],
      previous = v.cycles[i - 1];
    if (!c || typeof c !== "object" || Array.isArray(c) || c.day !== i + 1) return null;
    if (c.status === "protected") {
      if (
        !exact(c, ["day", "status", "targetId", "timing"]) ||
        !id(c.targetId) ||
        !["night", "day"].includes(c.timing as string) ||
        (previous?.status === "protected" && previous.targetId === c.targetId)
      )
        return null;
    } else if (
      !exact(c, ["day", "status"]) ||
      !["open", "passed", "unused"].includes(c.status as string) ||
      (c.status === "open" && i !== v.cycles.length - 1)
    )
      return null;
  }
  return v as unknown as AwakenedGuardState;
}

interface ProtectionBase {
  readonly policy: typeof AWAKENED_GUARD_POLICY;
  readonly day: number;
}
export interface AwakenedGuardPayloadMap {
  awakened_self_destruct_declared: ProtectionBase & {
    readonly actorId: number;
    readonly window: ActionWindow;
  };
  awakened_self_destruct_resolved: ProtectionBase & {
    readonly actorId: number;
    readonly window: ActionWindow;
    readonly deaths: readonly number[];
  };
  awakened_guard_cycle_started: ProtectionBase & { readonly actorId: number };
  awakened_protection_chosen: ProtectionBase & {
    readonly actorId: number;
    readonly timing: "night" | "day";
    readonly mode: "protect" | "wait" | "pass";
    readonly targetId: number | null;
    readonly outcome: "protected" | "wait" | "passed" | "unused";
  };
  awakened_protection_blocked: ProtectionBase & { readonly targetId: number };
  awakened_protection_revealed: ProtectionBase & {
    readonly actorId: number;
    readonly targetId: number;
  };
  awakened_protection_block_detail: ProtectionBase & {
    readonly actorId: number;
    readonly targetId: number;
    readonly phase: Phase;
    readonly rootPhase: Phase;
    readonly causes: readonly DeathCause[];
  };
  awakened_protection_expired: ProtectionBase & { readonly actorId: number };
}
export type AwakenedGuardEventType = keyof AwakenedGuardPayloadMap;
export type AwakenedGuardFact = {
  [K in AwakenedGuardEventType]: { readonly type: K; readonly payload: AwakenedGuardPayloadMap[K] };
}[AwakenedGuardEventType];
const eventTypes: readonly string[] = [
  "awakened_self_destruct_declared",
  "awakened_self_destruct_resolved",
  "awakened_guard_cycle_started",
  "awakened_protection_chosen",
  "awakened_protection_blocked",
  "awakened_protection_revealed",
  "awakened_protection_block_detail",
  "awakened_protection_expired",
];
export function isAwakenedGuardEventType(value: unknown): value is AwakenedGuardEventType {
  return typeof value === "string" && eventTypes.includes(value);
}
/** 事实只核精确惰性数据；受众与付款来源仍须独立归档验证，JSON本身不授保护。 */
export function readAwakenedGuardFact(type: unknown, payload: unknown): AwakenedGuardFact | null {
  try {
    if (!isAwakenedGuardEventType(type)) return null;
    const p = copyEventData(payload, 32);
    if (
      !exact(p, [
        "policy",
        "day",
        ...(type === "awakened_self_destruct_declared"
          ? ["actorId", "window"]
          : type === "awakened_self_destruct_resolved"
            ? ["actorId", "window", "deaths"]
            : type === "awakened_protection_chosen"
              ? ["actorId", "timing", "mode", "targetId", "outcome"]
              : type === "awakened_protection_blocked"
                ? ["targetId"]
                : type === "awakened_protection_revealed"
                  ? ["actorId", "targetId"]
                  : type === "awakened_protection_block_detail"
                    ? ["actorId", "targetId", "phase", "rootPhase", "causes"]
                    : ["actorId"]),
      ]) ||
      p.policy !== AWAKENED_GUARD_POLICY ||
      !id(p.day)
    )
      return null;
    if (type !== "awakened_protection_blocked" && !id(p.actorId)) return null;
    if (type === "awakened_self_destruct_declared" || type === "awakened_self_destruct_resolved") {
      if (!Object.values(ActionWindow).includes(p.window as ActionWindow)) return null;
      if (
        type === "awakened_self_destruct_resolved" &&
        (!Array.isArray(p.deaths) || p.deaths.length > 1 || p.deaths.some((id) => id !== p.actorId))
      )
        return null;
    }
    if (type === "awakened_protection_chosen") {
      if (!["night", "day"].includes(p.timing as string)) return null;
      if (p.mode === "protect") {
        if (!id(p.targetId) || p.outcome !== "protected") return null;
      } else if (p.mode === "pass") {
        if (p.targetId !== null || p.outcome !== "passed") return null;
      } else if (p.mode === "wait") {
        if (p.targetId !== null || !["wait", "unused"].includes(p.outcome as string)) return null;
      } else return null;
    }
    if (
      type === "awakened_protection_blocked" ||
      type === "awakened_protection_block_detail" ||
      type === "awakened_protection_revealed"
    ) {
      if (!id(p.targetId)) return null;
    }
    if (type === "awakened_protection_block_detail") {
      if (
        ![Phase.Night, Phase.Day, Phase.Voting].includes(p.phase as Phase) ||
        ![Phase.Night, Phase.Day, Phase.Voting].includes(p.rootPhase as Phase) ||
        !Array.isArray(p.causes) ||
        !p.causes.length ||
        new Set(p.causes).size !== p.causes.length ||
        p.causes.some((c) => !Object.values(DeathCause).includes(c as DeathCause))
      )
        return null;
    }
    return { type, payload: p } as unknown as AwakenedGuardFact;
  } catch {
    return null;
  }
}
/** 夜选择仅本人，白天实际亮牌保护公开；命中公告中性，细因和到期保God私有。 */
export function awakenedGuardFactAudience(fact: AwakenedGuardFact): readonly number[] | undefined {
  if (fact.type === "awakened_protection_blocked" || fact.type === "awakened_protection_revealed")
    return undefined;
  if (
    fact.type === "awakened_self_destruct_declared" ||
    fact.type === "awakened_self_destruct_resolved"
  )
    return undefined;
  if (
    fact.type === "awakened_protection_block_detail" ||
    fact.type === "awakened_protection_expired"
  )
    return [];
  return [fact.payload.actorId];
}
