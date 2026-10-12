import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { normalizePair, type Pair } from "./state";
/** This journal stores only owner-authorized knowledge, never actual trigger receipts. */
export interface FragrantKnowledge {
  knownWolfId: number | null;
  lastOpenedNight: number;
  lastChoice: { day: number; pairIds: Pair | null } | null;
  activeBinding: { createdNight: number; expiresNight: number; pairIds: Pair } | null;
  used: boolean;
  knifeNotices: readonly { day: number; eligible: boolean }[];
}
const id = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER - 1;
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const pair = (v: unknown): v is Pair =>
  Array.isArray(v) && v.length === 2 && id(v[0]) && id(v[1]) && v[0] < v[1];
export function freshFragrantKnowledge(): FragrantKnowledge {
  return {
    knownWolfId: null,
    lastOpenedNight: 0,
    lastChoice: null,
    activeBinding: null,
    used: false,
    knifeNotices: [],
  };
}
export function readFragrantKnowledge(value: unknown): FragrantKnowledge | null {
  try {
    const v = snapshotPlainData(value);
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
/** Eligibility was frozen by the real night owner; history grants no live permission. */
export function knowFragrantKnife(
  value: FragrantKnowledge,
  day: number,
  eligible: boolean,
): FragrantKnowledge {
  const s = valid(value);
  if (
    day !== s.lastOpenedNight ||
    !id(day) ||
    typeof eligible !== "boolean" ||
    s.knownWolfId === null ||
    (s.knifeNotices.at(-1)?.day ?? 0) >= day ||
    (s.knifeNotices.some((n) => n.eligible) && !eligible)
  )
    throw Error("fragrant_knife_notice_invalid");
  return { ...s, knifeNotices: [...s.knifeNotices, { day, eligible }] };
}
function valid(v: FragrantKnowledge) {
  const s = readFragrantKnowledge(v);
  if (!s) throw Error("fragrant_knowledge_invalid");
  return s;
}
export function knowFragrantWolf(value: FragrantKnowledge, targetId: number): FragrantKnowledge {
  const s = valid(value);
  if (!id(targetId) || s.knownWolfId !== null || s.lastOpenedNight !== 1)
    throw Error("fragrant_known_wolf_duplicate");
  return { ...s, knownWolfId: targetId };
}
/** Only a committed real night-open owner may call this; phase labels never call it. */
export function knowFragrantNightOpen(value: FragrantKnowledge, day: number): FragrantKnowledge {
  const s = valid(value);
  if (!id(day) || day <= s.lastOpenedNight) throw Error("fragrant_known_night_invalid");
  return { ...s, lastOpenedNight: day, activeBinding: null };
}
export function knowFragrantChoice(
  value: FragrantKnowledge,
  day: number,
  targets: unknown,
): FragrantKnowledge {
  const s = valid(value);
  if (
    !id(day) ||
    day !== s.lastOpenedNight ||
    s.lastChoice?.day === day ||
    s.knownWolfId === null ||
    s.used
  )
    throw Error("fragrant_known_choice_unavailable");
  const pairIds = targets === null ? null : normalizePair(targets);
  return {
    ...s,
    lastChoice: { day, pairIds },
    activeBinding: pairIds === null ? null : { createdNight: day, expiresNight: day + 1, pairIds },
  };
}
/** Supply already-published real deaths from the authorized event prefix, not proposed damage. */
export function knowFragrantPublishedDeaths(
  value: FragrantKnowledge,
  day: number,
  publishedIds: unknown,
): FragrantKnowledge {
  const s = valid(value),
    ids = snapshotPlainData(publishedIds);
  if (
    !id(day) ||
    !Array.isArray(ids) ||
    ids.some((v) => !id(v)) ||
    new Set(ids).size !== ids.length
  )
    throw Error("fragrant_public_deaths_invalid");
  if (
    !s.activeBinding ||
    s.activeBinding.createdNight !== day ||
    !s.activeBinding.pairIds.some((v) => ids.includes(v))
  )
    return s;
  return { ...s, activeBinding: null, used: true };
}
