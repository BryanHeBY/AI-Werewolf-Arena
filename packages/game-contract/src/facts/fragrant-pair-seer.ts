/**
 * 负责寻香魅影／觉醒预言家的事实、知识结构及纯数据读取。输入为原事件名和无 reviver 的 JSON.parse 数据或已确认的惰性值。
 * 输出为按原精确字段、上限及历史关联校验的复制数据，拒绝或复制异常时返回 null；事件受众分类不自动授予玩家可见性。
 * 知识与绑定记录不携带运行句柄，不在此触发连带死亡或支付资源；反射可执行 Proxy trap，Node 入口须先拒绝危险对象。
 */
import { copyEventData } from "../inert-event-data";
export const FRAGRANT_PAIR_POLICY = "awa_fragrant_pair_seer_v1" as const;
export type FragrantPair = readonly [number, number];
export interface PairCheckFact {
  day: number;
  targetIds: FragrantPair;
  containsWerewolf: boolean;
}
// 未获知狼人、尚未开夜、空过选择与无有效绑定分别用原 null／0 字段表达，不补推断状态。
export interface FragrantKnowledge {
  knownWolfId: number | null;
  lastOpenedNight: number;
  lastChoice: { day: number; pairIds: FragrantPair | null } | null;
  activeBinding: { createdNight: number; expiresNight: number; pairIds: FragrantPair } | null;
  used: boolean;
  knifeNotices: readonly { day: number; eligible: boolean }[];
}
export interface FragrantPlayerState extends FragrantKnowledge {
  actorId: number;
  hasInheritedKnife: boolean;
  canVoteForKill: boolean;
}
const id = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER - 1;
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const pair = (v: unknown): v is FragrantPair =>
  Array.isArray(v) && v.length === 2 && id(v[0]) && id(v[1]) && v[0] < v[1];

export function readFragrantKnownState(value: unknown): FragrantKnowledge | null {
  try {
    const v = copyEventData(value, 65536);
    if (
      !exact(v, [
        "knownWolfId",
        "lastOpenedNight",
        "lastChoice",
        "activeBinding",
        "used",
        "knifeNotices",
      ]) ||
      (v.knownWolfId !== null && !id(v.knownWolfId)) ||
      (!id(v.lastOpenedNight) && v.lastOpenedNight !== 0) ||
      typeof v.used !== "boolean" ||
      !Array.isArray(v.knifeNotices)
    )
      return null;
    let previous = 0,
      inherited = false;
    for (const notice of v.knifeNotices) {
      if (
        !exact(notice, ["day", "eligible"]) ||
        !id(notice.day) ||
        notice.day <= previous ||
        notice.day > Number(v.lastOpenedNight) ||
        typeof notice.eligible !== "boolean" ||
        (notice.day === 1 && notice.eligible) ||
        (inherited && !notice.eligible) ||
        v.knownWolfId === null
      )
        return null;
      previous = notice.day;
      inherited ||= notice.eligible;
    }
    if (
      v.lastChoice !== null &&
      (!exact(v.lastChoice, ["day", "pairIds"]) ||
        !id(v.lastChoice.day) ||
        Number(v.lastChoice.day) > Number(v.lastOpenedNight) ||
        (v.lastChoice.pairIds !== null && !pair(v.lastChoice.pairIds)))
    )
      return null;
    // 活跃记录须与本夜选择及到期夜一致；这是知识副本的一致性，不是运行绑定的有效性查询。
    if (v.activeBinding !== null) {
      const b = v.activeBinding;
      if (
        v.used ||
        !exact(b, ["createdNight", "expiresNight", "pairIds"]) ||
        !id(b.createdNight) ||
        b.createdNight !== v.lastOpenedNight ||
        b.expiresNight !== b.createdNight + 1 ||
        !pair(b.pairIds) ||
        !exact(v.lastChoice, ["day", "pairIds"]) ||
        v.lastChoice.day !== b.createdNight ||
        JSON.stringify(v.lastChoice.pairIds) !== JSON.stringify(b.pairIds)
      )
        return null;
    }
    if (v.lastChoice !== null && v.knownWolfId === null) return null;
    if (v.knownWolfId !== null && !id(v.lastOpenedNight)) return null;
    if (
      v.used &&
      (v.activeBinding !== null ||
        v.knownWolfId === null ||
        !exact(v.lastChoice, ["day", "pairIds"]) ||
        !pair(v.lastChoice.pairIds))
    )
      return null;
    if (
      !v.used &&
      exact(v.lastChoice, ["day", "pairIds"]) &&
      v.lastChoice.day === v.lastOpenedNight &&
      v.lastChoice.pairIds !== null &&
      v.activeBinding === null
    )
      return null;
    return v as unknown as FragrantKnowledge;
  } catch {
    return null;
  }
}

export function readPairCheckFact(value: unknown): PairCheckFact | null {
  try {
    const p = copyEventData(value);
    return exact(p, ["day", "targetIds", "containsWerewolf"]) &&
      id(p.day) &&
      pair(p.targetIds) &&
      typeof p.containsWerewolf === "boolean"
      ? (p as unknown as PairCheckFact)
      : null;
  } catch {
    return null;
  }
}
type Base = { policy: typeof FRAGRANT_PAIR_POLICY; actorId: number; day: number };
export interface FragrantPairPayloadMap {
  fragrant_night_opened: Base & { knowledgeDrawCount: 0 | 1 };
  fragrant_wave_committed: Base & {
    deaths: number[];
    deathSources: Record<string, string[]>;
    deathPhases: Record<string, "night" | "day" | "voting">;
    initialWave: boolean;
  };
  fragrant_pair_chosen: Base & { pairIds: FragrantPair | null };
  fragrant_pair_inspected: Base & { targetIds: FragrantPair; containsWerewolf: boolean };
  fragrant_night_notified: Base & { known: FragrantKnowledge };
  fragrant_binding_expired: Base & {
    bindingId: string;
    createdNight: number;
    pairIds: FragrantPair;
  };
  fragrant_link_triggered: Base & {
    bindingId: string;
    pairIds: FragrantPair;
    rootId: number;
    addedTargetId: number | null;
    rootPhase: "night" | "day" | "voting";
    initialWave: boolean;
  };
}
export const FRAGRANT_PAIR_EVENT_TYPES = Object.freeze([
  "fragrant_wave_committed",
  "fragrant_night_opened",
  "fragrant_pair_chosen",
  "fragrant_pair_inspected",
  "fragrant_night_notified",
  "fragrant_binding_expired",
  "fragrant_link_triggered",
] as const);
export type FragrantPairEventType = keyof FragrantPairPayloadMap;
/** 这里只按事件名分类受众；解析上帝事实不会授予某位玩家读取它的权限。 */
export function fragrantPairVisibility(type: string): "actor" | "god" | null {
  if (
    type === "fragrant_wave_committed" ||
    type === "fragrant_night_opened" ||
    type === "fragrant_binding_expired" ||
    type === "fragrant_link_triggered"
  )
    return "god";
  return ["fragrant_pair_chosen", "fragrant_pair_inspected", "fragrant_night_notified"].includes(
    type,
  )
    ? "actor"
    : null;
}
export function readFragrantPairFact<T extends FragrantPairEventType>(
  type: T,
  value: unknown,
): FragrantPairPayloadMap[T] | null;
export function readFragrantPairFact(
  type: string,
  value: unknown,
): FragrantPairPayloadMap[FragrantPairEventType] | null;
export function readFragrantPairFact(
  type: string,
  value: unknown,
): FragrantPairPayloadMap[FragrantPairEventType] | null {
  if (!(FRAGRANT_PAIR_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(value, 65536),
      base = ["policy", "actorId", "day"];
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const f = p as Record<string, unknown>;
    if (f.policy !== FRAGRANT_PAIR_POLICY || !id(f.actorId) || !id(f.day)) return null;
    let valid = false;
    switch (type) {
      case "fragrant_night_opened":
        valid =
          exact(f, [...base, "knowledgeDrawCount"]) &&
          f.knowledgeDrawCount === (f.day === 1 ? 1 : 0);
        break;
      case "fragrant_wave_committed": {
        const ids = f.deaths,
          sources = f.deathSources,
          phases = f.deathPhases;
        valid =
          exact(f, [...base, "deaths", "deathSources", "deathPhases", "initialWave"]) &&
          Array.isArray(ids) &&
          ids.length > 0 &&
          ids.every(id) &&
          new Set(ids).size === ids.length &&
          typeof f.initialWave === "boolean" &&
          !!sources &&
          typeof sources === "object" &&
          !Array.isArray(sources) &&
          !!phases &&
          typeof phases === "object" &&
          !Array.isArray(phases) &&
          Object.keys(sources).length === ids.length &&
          Object.keys(phases).length === ids.length &&
          ids.every((n) => {
            const causes = (sources as Record<string, unknown>)[String(n)],
              origin = (phases as Record<string, unknown>)[String(n)];
            return (
              Array.isArray(causes) &&
              causes.length > 0 &&
              new Set(causes).size === causes.length &&
              causes.every(
                (c) =>
                  typeof c === "string" &&
                  [
                    "wolf_kill",
                    "poison",
                    "exile",
                    "self_destruct",
                    "shot",
                    "fragrant_link",
                  ].includes(c),
              ) &&
              typeof origin === "string" &&
              ["night", "day", "voting"].includes(origin)
            );
          });
        break;
      }
      case "fragrant_pair_chosen":
        valid = exact(f, [...base, "pairIds"]) && (f.pairIds === null || pair(f.pairIds));
        break;
      case "fragrant_pair_inspected":
        valid =
          exact(f, [...base, "targetIds", "containsWerewolf"]) &&
          pair(f.targetIds) &&
          typeof f.containsWerewolf === "boolean";
        break;
      case "fragrant_night_notified": {
        const k = readFragrantKnownState(f.known);
        valid =
          exact(f, [...base, "known"]) &&
          !!k &&
          k.knownWolfId !== null &&
          k.knownWolfId !== f.actorId &&
          k.lastOpenedNight === f.day &&
          k.activeBinding === null &&
          (k.lastChoice === null || k.lastChoice.day < f.day) &&
          k.knifeNotices.at(-1)?.day === f.day &&
          k.knifeNotices.length === f.day &&
          k.knifeNotices.every((notice, index) => notice.day === index + 1) &&
          (f.day !== 1 ||
            (!k.used &&
              k.lastChoice === null &&
              k.knifeNotices.length === 1 &&
              !k.knifeNotices[0]!.eligible));
        break;
      }
      case "fragrant_binding_expired":
        valid =
          exact(f, [...base, "bindingId", "createdNight", "pairIds"]) &&
          id(f.createdNight) &&
          f.day === f.createdNight + 1 &&
          f.bindingId === `fragrant:night:${f.createdNight}` &&
          pair(f.pairIds);
        break;
      case "fragrant_link_triggered":
        valid =
          exact(f, [
            ...base,
            "bindingId",
            "pairIds",
            "rootId",
            "addedTargetId",
            "rootPhase",
            "initialWave",
          ]) &&
          f.bindingId === `fragrant:night:${f.day}` &&
          pair(f.pairIds) &&
          id(f.rootId) &&
          f.pairIds.includes(f.rootId) &&
          (f.addedTargetId === null ||
            (id(f.addedTargetId) &&
              f.addedTargetId !== f.rootId &&
              f.pairIds.includes(f.addedTargetId))) &&
          typeof f.rootPhase === "string" &&
          ["night", "day", "voting"].includes(f.rootPhase) &&
          typeof f.initialWave === "boolean";
        break;
    }
    return valid ? (f as unknown as FragrantPairPayloadMap[FragrantPairEventType]) : null;
  } catch {
    return null;
  }
}
