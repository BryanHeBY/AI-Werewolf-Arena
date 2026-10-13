/**
 * Owns Fragrant's player-known journal and pure knowledge updates.
 * Inputs are recorded visible notices, known wolf/choice/death facts and pair IDs;
 * outputs are checked copied knowledge and updated journal data in original order.
 * This journal never derives hidden trigger receipts or grants roster/action
 * authority; its shared pair type is neutral data, not a live state handle.
 */

import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { normalizePair } from "./state";
/** This journal stores only owner-authorized knowledge, never actual trigger receipts. */
export type { FragrantKnowledge } from "@ai-werewolf-arena/game-text";
import { readFragrantKnownState, type FragrantKnowledge } from "@ai-werewolf-arena/game-text";
const id = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER - 1;
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
    return readFragrantKnownState(snapshotPlainData(value, new Set(), 0, 65536));
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
    (day === 1 && eligible) ||
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
