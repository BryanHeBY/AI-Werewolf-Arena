/**
 * 负责典狱长的纯历史与秘密事实格式。输入仅为惰性数据，输出严格脱离副本；
 * 历史保存真实pair付款与每名参与者已接受的独立决定，不从相同字段恢复夜窗或原生命许可。
 * 未完成双方决定的记录仍是已消费参与次数的有效前缀，resolved不能替代两份回执。
 */
import { copyEventData } from "../inert-event-data";
export const WARDEN_POLICY = "awa_melbourne_warden_v1" as const;
export const WARDEN_FORCE_POLICY = "awa_warden_partner_native_v1" as const;
export type WardenDecision = "trade" | "betray";
export interface WardenReceipt {
  readonly playerId: number;
  readonly choice: WardenDecision;
}
export interface WardenNight {
  readonly day: number;
  readonly pair: readonly [number, number] | null;
  readonly decisions: readonly WardenReceipt[];
  readonly resolved: boolean;
}
export interface WardenState {
  readonly policy: typeof WARDEN_POLICY;
  readonly forcePolicy: typeof WARDEN_FORCE_POLICY;
  readonly history: readonly WardenNight[];
}
type Base = { policy: typeof WARDEN_POLICY; day: number };
export interface WardenPayloadMap {
  warden_pair_chosen: Base & { actorId: number; pair: readonly [number, number] | null };
  warden_partner_notified: Base & { actorId: number; partnerId: number };
  warden_decision: Base & { actorId: number; choice: WardenDecision };
  warden_resolved: Base & {
    actorId: number;
    pair: readonly [number, number];
    choices: readonly [WardenDecision, WardenDecision];
    outcome: "protect" | "force" | "deal";
    dealIds: readonly number[];
  };
}
export const WARDEN_EVENT_TYPES = Object.freeze([
  "warden_pair_chosen",
  "warden_partner_notified",
  "warden_decision",
  "warden_resolved",
] as const);
export type WardenEventType = keyof WardenPayloadMap;
export type WardenFact = {
  [K in WardenEventType]: { type: K; payload: WardenPayloadMap[K] };
}[WardenEventType];
const id = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const choice = (v: unknown): v is WardenDecision => v === "trade" || v === "betray";
function exact(v: unknown, keys: readonly string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k))
  );
}
const pair = (v: unknown): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && id(v[0]) && id(v[1]) && v[0] !== v[1];
export function readWardenStateData(input: unknown): WardenState | null {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (
      Reflect.ownKeys(input).length !== 3 ||
      !["policy", "forcePolicy", "history"].every(
        (k) => descriptors[k] && descriptors[k]!.enumerable && "value" in descriptors[k]!,
      )
    )
      return null;
    const history = descriptors.history!.value;
    if (
      !Array.isArray(history) ||
      Object.getPrototypeOf(history) !== Array.prototype ||
      Reflect.ownKeys(history).length !== history.length + 1 ||
      history.length > 1000
    )
      return null;
    const rows: unknown[] = [];
    for (let i = 0; i < history.length; i++) {
      const d = Object.getOwnPropertyDescriptor(history, String(i));
      if (!d || !("value" in d)) return null;
      rows.push(copyEventData(d.value));
    }
    const s = {
      policy: copyEventData(descriptors.policy!.value),
      forcePolicy: copyEventData(descriptors.forcePolicy!.value),
      history: rows,
    };
    if (
      !exact(s, ["policy", "forcePolicy", "history"]) ||
      s.policy !== WARDEN_POLICY ||
      s.forcePolicy !== WARDEN_FORCE_POLICY ||
      !Array.isArray(s.history)
    )
      return null;
    let day = 1;
    const used = new Set<number>();
    for (const r of s.history) {
      if (
        !exact(r, ["day", "pair", "decisions", "resolved"]) ||
        !id(r.day) ||
        r.day <= day ||
        !(r.pair === null || pair(r.pair)) ||
        !Array.isArray(r.decisions) ||
        typeof r.resolved !== "boolean"
      )
        return null;
      day = r.day;
      if (r.pair === null) {
        if (r.decisions.length || !r.resolved) return null;
        continue;
      }
      for (const p of r.pair) {
        if (used.has(p)) return null;
        used.add(p);
      }
      const seen = new Set<number>();
      for (const d of r.decisions) {
        if (
          !exact(d, ["playerId", "choice"]) ||
          !id(d.playerId) ||
          !r.pair.includes(d.playerId) ||
          seen.has(d.playerId) ||
          !choice(d.choice)
        )
          return null;
        seen.add(d.playerId);
      }
      if (r.resolved !== (r.decisions.length === 2)) return null;
    }
    return s as unknown as WardenState;
  } catch {
    return null;
  }
}
export function readWardenFact(type: string, input: unknown): WardenFact | null {
  if (!(WARDEN_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(input);
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const r = p as Record<string, unknown>;
    if (r.policy !== WARDEN_POLICY || !id(r.day) || r.day < 2 || !id(r.actorId)) return null;
    if (
      type === "warden_pair_chosen" &&
      exact(r, ["policy", "day", "actorId", "pair"]) &&
      (r.pair === null || pair(r.pair))
    )
      return { type, payload: r } as WardenFact;
    if (
      type === "warden_partner_notified" &&
      exact(r, ["policy", "day", "actorId", "partnerId"]) &&
      id(r.partnerId) &&
      r.partnerId !== r.actorId
    )
      return { type, payload: r } as WardenFact;
    if (
      type === "warden_decision" &&
      exact(r, ["policy", "day", "actorId", "choice"]) &&
      choice(r.choice)
    )
      return { type, payload: r } as WardenFact;
    if (
      type === "warden_resolved" &&
      exact(r, ["policy", "day", "actorId", "pair", "choices", "outcome", "dealIds"]) &&
      pair(r.pair) &&
      Array.isArray(r.choices) &&
      r.choices.length === 2 &&
      r.choices.every(choice) &&
      ["protect", "force", "deal"].includes(String(r.outcome)) &&
      Array.isArray(r.dealIds) &&
      r.dealIds.every(id)
    )
      return { type, payload: r } as WardenFact;
    return null;
  } catch {
    return null;
  }
}

export interface WardenKnowledge {
  readonly policy: typeof WARDEN_POLICY;
  readonly forcePolicy: typeof WARDEN_FORCE_POLICY;
  readonly history: readonly {
    readonly day: number;
    readonly pair: readonly [number, number] | null;
    readonly ownChoice?: WardenDecision;
  }[];
}
export function wardenFactAudience(type: WardenEventType): "actor" | "god" {
  return type === "warden_resolved" ? "god" : "actor";
}
