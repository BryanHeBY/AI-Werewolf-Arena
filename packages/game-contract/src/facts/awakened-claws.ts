/**
 * 负责觉醒狼王双爪及受传狼爪的纯数据格式。状态记录真实库存与已付历史，不包含生命、许可或可执行回调。
 * 输入为 JSON 数据，输出严格脱离副本或 null；相同 id／剩余字段不能重建运行授权。
 * 两个原生单位与一个受传单位互斥，转出的原单位永不恢复；公开事实不暴露原生库存。
 */
import { copyEventData } from "../inert-event-data";

export const AWAKENED_CLAW_POLICY = "awa_awakened_wolf_king_v1" as const;
export const AWAKENED_WOLF_KING_ROLE_ID = "awakened_wolf_king" as const;
export type AwakenedClawStatus = "ready" | "spent" | "transferred" | "expired";
export interface AwakenedClawUnit {
  readonly id: string;
  readonly source:
    | { readonly kind: "native"; readonly index: 1 | 2 }
    | {
        readonly kind: "bequest";
        readonly giverId: number;
        readonly giverUnitId: string;
        readonly day: number;
      };
  readonly status: AwakenedClawStatus;
}
export interface AwakenedClawBequest {
  readonly day: number;
  readonly targetId: number;
  readonly unitId: string;
}
export interface AwakenedClawState {
  readonly policy: typeof AWAKENED_CLAW_POLICY;
  readonly units: readonly AwakenedClawUnit[];
  readonly bequests: readonly AwakenedClawBequest[];
}
export interface AwakenedClawPayloadMap {
  awakened_claw_bequeathed: {
    policy: typeof AWAKENED_CLAW_POLICY;
    day: number;
    actorId: number;
    targetId: number;
    unitId: string;
    receivedUnitId: string;
  };
  awakened_claw_spent: {
    policy: typeof AWAKENED_CLAW_POLICY;
    day: number;
    actorId: number;
    unitId: string;
    targetId: number | null;
  };
  awakened_claws_expired: {
    policy: typeof AWAKENED_CLAW_POLICY;
    day: number;
    actorId: number;
    unitIds: readonly string[];
  };
}
export type AwakenedClawEventType = keyof AwakenedClawPayloadMap;
export type AwakenedClawFact = {
  [K in AwakenedClawEventType]: { readonly type: K; readonly payload: AwakenedClawPayloadMap[K] };
}[AwakenedClawEventType];
export const AWAKENED_CLAW_EVENT_TYPES = Object.freeze([
  "awakened_claw_bequeathed",
  "awakened_claw_spent",
  "awakened_claws_expired",
] as const);
function exact(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((key) => Object.hasOwn(v, key))
  );
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function id(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}
function unitId(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^awakened_claw:(?:native:[12]|bequest:[1-9]\d*:[1-9]\d*:[12])$/.test(v)
  );
}

/** 严格校验源单位、去向及日次；只接受两原生或单受传，拒绝混装与库存来源漂移。 */
export function readAwakenedClawStateData(value: unknown): AwakenedClawState | null {
  try {
    const s = copyEventData(value, 32768);
    if (
      !exact(s, ["policy", "units", "bequests"]) ||
      s.policy !== AWAKENED_CLAW_POLICY ||
      !Array.isArray(s.units) ||
      !Array.isArray(s.bequests)
    )
      return null;
    if (s.units.length < 1 || s.units.length > 2 || s.bequests.length > 2) return null;
    const ids = new Set<string>();
    for (const u of s.units) {
      if (
        !exact(u, ["id", "source", "status"]) ||
        !unitId(u.id) ||
        ids.has(u.id) ||
        !["ready", "spent", "transferred", "expired"].includes(u.status as string)
      )
        return null;
      ids.add(u.id);
      const source = u.source;
      if (exact(source, ["kind", "index"]) && source.kind === "native") {
        if (
          ![1, 2].includes(source.index as number) ||
          u.id !== `awakened_claw:native:${source.index}` ||
          s.units.length !== 2
        )
          return null;
      } else if (
        exact(source, ["kind", "giverId", "giverUnitId", "day"]) &&
        source.kind === "bequest"
      ) {
        if (
          !id(source.giverId) ||
          !id(source.day) ||
          !["awakened_claw:native:1", "awakened_claw:native:2"].includes(
            source.giverUnitId as string,
          ) ||
          u.id !==
            `awakened_claw:bequest:${source.giverId}:${source.day}:${String(source.giverUnitId).slice(-1)}` ||
          s.units.length !== 1 ||
          s.bequests.length !== 0 ||
          u.status === "transferred"
        )
          return null;
      } else return null;
    }
    let previousDay = 0;
    const transferred = new Set<string>();
    for (const row of s.bequests) {
      if (
        !exact(row, ["day", "targetId", "unitId"]) ||
        !id(row.day) ||
        row.day <= previousDay ||
        !id(row.targetId) ||
        !unitId(row.unitId) ||
        transferred.has(row.unitId)
      )
        return null;
      const u = s.units.find((unit) => unit.id === row.unitId);
      if (!u || u.source.kind !== "native" || u.status !== "transferred") return null;
      previousDay = row.day;
      transferred.add(row.unitId);
    }
    if (s.units.some((u) => u.status === "transferred" && !transferred.has(u.id))) return null;
    return s as unknown as AwakenedClawState;
  } catch {
    return null;
  }
}

/** 已发表事实与库存授权分开；受传双方通过原 audience 得知，观察层不得自行扩大受众。 */
export function readAwakenedClawFact(type: string, payload: unknown): AwakenedClawFact | null {
  if (!(AWAKENED_CLAW_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(payload, 32768),
      base = ["policy", "day", "actorId"];
    if (!record(p) || p.policy !== AWAKENED_CLAW_POLICY || !id(p.day) || !id(p.actorId))
      return null;
    let valid = false;
    if (type === "awakened_claw_bequeathed")
      valid =
        exact(p, [...base, "targetId", "unitId", "receivedUnitId"]) &&
        id(p.targetId) &&
        p.actorId !== p.targetId &&
        ["awakened_claw:native:1", "awakened_claw:native:2"].includes(p.unitId as string) &&
        p.receivedUnitId ===
          `awakened_claw:bequest:${p.actorId}:${p.day}:${String(p.unitId).slice(-1)}`;
    if (type === "awakened_claw_spent")
      valid =
        exact(p, [...base, "unitId", "targetId"]) &&
        unitId(p.unitId) &&
        (p.targetId === null || (id(p.targetId) && p.targetId !== p.actorId));
    if (type === "awakened_claws_expired")
      valid =
        exact(p, [...base, "unitIds"]) &&
        Array.isArray(p.unitIds) &&
        p.unitIds.length >= 1 &&
        p.unitIds.length <= 2 &&
        p.unitIds.every(unitId) &&
        new Set(p.unitIds).size === p.unitIds.length;
    return valid ? ({ type, payload: p } as AwakenedClawFact) : null;
  } catch {
    return null;
  }
}
