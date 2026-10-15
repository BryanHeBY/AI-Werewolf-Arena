/**
 * 负责觉醒骑士已付尝试的纯历史结构。输入为未知JSON，输出严格脱离副本，不授新决斗或死亡权限。
 * 目标稳定ID整局唯一；同链仅Wolf分支后可再尝试，Good分支关闭该链，新链编号从历史连续推导。
 * 历史不保存Alive镜像或延期遗言队列；真实死亡、徽与结束链的遗言由引擎拥有。
 */
import { copyEventData } from "../inert-event-data";
export const AWAKENED_KNIGHT_ROLE_ID = "awakened_knight" as const;
export const AWAKENED_DUEL_POLICY = "awa_awakened_duel_chain_v1" as const;
export interface AwakenedDuelAttempt {
  readonly day: number;
  readonly chain: number;
  readonly targetId: number;
  readonly branch: "wolf" | "good";
}
export interface AwakenedKnightState {
  readonly policy: typeof AWAKENED_DUEL_POLICY;
  readonly attempts: readonly AwakenedDuelAttempt[];
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
export function readAwakenedKnightStateData(value: unknown): AwakenedKnightState | null {
  let v: unknown;
  try {
    v = copyEventData(value, 1000);
  } catch {
    return null;
  }
  if (
    !exact(v, ["policy", "attempts"]) ||
    v.policy !== AWAKENED_DUEL_POLICY ||
    !Array.isArray(v.attempts)
  )
    return null;
  const targets = new Set<number>();
  let previous: AwakenedDuelAttempt | undefined;
  for (const row of v.attempts) {
    if (
      !exact(row, ["day", "chain", "targetId", "branch"]) ||
      !id(row.day) ||
      !id(row.chain) ||
      !id(row.targetId) ||
      !["wolf", "good"].includes(row.branch as string) ||
      targets.has(row.targetId)
    )
      return null;
    if (
      !previous
        ? row.chain !== 1
        : row.day < previous.day ||
          (row.chain === previous.chain
            ? row.day !== previous.day || previous.branch !== "wolf"
            : row.chain !== previous.chain + 1)
    )
      return null;
    targets.add(row.targetId);
    previous = row as unknown as AwakenedDuelAttempt;
  }
  return v as unknown as AwakenedKnightState;
}

interface DuelBase {
  readonly policy: typeof AWAKENED_DUEL_POLICY;
  readonly day: number;
  readonly actorId: number;
  readonly chain: number;
}
export interface AwakenedDuelPayloadMap {
  awakened_duel_resolved: DuelBase & {
    readonly targetId: number;
    readonly deaths: readonly number[];
  };
  awakened_duel_committed: DuelBase & {
    readonly targetId: number;
    readonly branch: "wolf" | "good";
  };
  awakened_duel_chain_ended: DuelBase & {
    readonly reason: "ended" | "no_targets" | "actor_lost" | "miss";
  };
}
export type AwakenedDuelEventType = keyof AwakenedDuelPayloadMap;
export type AwakenedDuelFact = {
  [K in AwakenedDuelEventType]: { readonly type: K; readonly payload: AwakenedDuelPayloadMap[K] };
}[AwakenedDuelEventType];
export function isAwakenedDuelEventType(value: unknown): value is AwakenedDuelEventType {
  return (
    value === "awakened_duel_committed" ||
    value === "awakened_duel_chain_ended" ||
    value === "awakened_duel_resolved"
  );
}
/** 精确字段与分支只描述已发表事实；不由归档恢复目标权限或实际生命。 */
export function readAwakenedDuelFact(type: unknown, payload: unknown): AwakenedDuelFact | null {
  try {
    if (!isAwakenedDuelEventType(type)) return null;
    const p = copyEventData(payload, 16);
    if (
      !exact(p, [
        "policy",
        "day",
        "actorId",
        "chain",
        ...(type === "awakened_duel_committed"
          ? ["targetId", "branch"]
          : type === "awakened_duel_resolved"
            ? ["targetId", "deaths"]
            : ["reason"]),
      ]) ||
      p.policy !== AWAKENED_DUEL_POLICY ||
      !id(p.day) ||
      !id(p.actorId) ||
      !id(p.chain)
    )
      return null;
    if (type === "awakened_duel_resolved") {
      if (
        !id(p.targetId) ||
        p.targetId === p.actorId ||
        !Array.isArray(p.deaths) ||
        !p.deaths.every(id) ||
        new Set(p.deaths).size !== p.deaths.length
      )
        return null;
      return {
        type,
        payload: {
          policy: AWAKENED_DUEL_POLICY,
          day: p.day,
          actorId: p.actorId,
          chain: p.chain,
          targetId: p.targetId,
          deaths: p.deaths,
        },
      };
    }
    if (
      type === "awakened_duel_committed"
        ? !id(p.targetId) ||
          p.targetId === p.actorId ||
          !["wolf", "good"].includes(p.branch as string)
        : !["ended", "no_targets", "actor_lost", "miss"].includes(p.reason as string)
    )
      return null;
    return { type, payload: p } as unknown as AwakenedDuelFact;
  } catch {
    return null;
  }
}
