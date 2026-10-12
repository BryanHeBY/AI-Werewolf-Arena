import { snapshotPlainData } from "../../../../core/domain/plain_data";

import { FRAGRANT_PAIR_POLICY, type FragrantPair } from "@ai-werewolf-arena/game-text";
export { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-text";
export type Pair = FragrantPair;
export interface PairCheck {
  day: number;
  targetIds: Pair;
  containsWerewolf: boolean;
}
export interface PairSeerState {
  policy: typeof FRAGRANT_PAIR_POLICY;
  history: readonly PairCheck[];
}
export interface Binding {
  id: string;
  createdNight: number;
  expiresNight: number;
  pairIds: Pair;
  status: { kind: "pending" } | { kind: "expired" | "triggered"; day: number };
}
export interface FragrantState {
  policy: typeof FRAGRANT_PAIR_POLICY;
  knownWolfId: number | null;
  knowledgeNight: 1 | null;
  lastChoice: { day: number; pairIds: Pair | null } | null;
  bindings: readonly Binding[];
  trigger: { bindingId: string; day: number; rootId: number; addedTargetId: number | null } | null;
}
const positive = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER - 1;
function exact(v: unknown, names: readonly string[]): v is Record<string, unknown> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v).length === names.length &&
    names.every((n) => Object.hasOwn(v, n))
  );
}
function pair(v: unknown): v is Pair {
  return Array.isArray(v) && v.length === 2 && positive(v[0]) && positive(v[1]) && v[0] < v[1];
}
export function normalizePair(v: unknown): Pair {
  const p = snapshotPlainData(v);
  if (!Array.isArray(p) || p.length !== 2 || !positive(p[0]) || !positive(p[1]) || p[0] === p[1])
    throw Error("fragrant_pair_invalid");
  return p[0] < p[1] ? [p[0], p[1]] : [p[1], p[0]];
}
export function freshPairSeerState(): PairSeerState {
  return { policy: FRAGRANT_PAIR_POLICY, history: [] };
}
export function readPairSeerState(value: unknown): PairSeerState | null {
  try {
    const v = snapshotPlainData(value, new Set(), 0, 65536);
    if (
      !exact(v, ["policy", "history"]) ||
      v.policy !== FRAGRANT_PAIR_POLICY ||
      !Array.isArray(v.history)
    )
      return null;
    let last = 0;
    const seenPairs = new Map<string, boolean>();
    for (const r of v.history) {
      if (
        !exact(r, ["day", "targetIds", "containsWerewolf"]) ||
        !positive(r.day) ||
        r.day <= last ||
        !pair(r.targetIds) ||
        typeof r.containsWerewolf !== "boolean"
      )
        return null;
      const key = JSON.stringify(r.targetIds),
        previous = seenPairs.get(key);
      if (previous !== undefined && previous !== r.containsWerewolf) return null;
      seenPairs.set(key, r.containsWerewolf);
      last = r.day;
    }
    return v as unknown as PairSeerState;
  } catch {
    return null;
  }
}
export function appendPairCheck(
  value: PairSeerState,
  day: number,
  targets: unknown,
  result: boolean,
): PairSeerState {
  const state = readPairSeerState(value);
  if (
    !state ||
    !positive(day) ||
    (state.history.at(-1)?.day ?? 0) >= day ||
    typeof result !== "boolean"
  )
    throw Error("fragrant_pair_check_unavailable");
  const targetIds = normalizePair(targets);
  if (
    state.history.some(
      (r) =>
        JSON.stringify(r.targetIds) === JSON.stringify(targetIds) && r.containsWerewolf !== result,
    )
  )
    throw Error("fragrant_pair_check_result_inconsistent");
  return {
    policy: FRAGRANT_PAIR_POLICY,
    history: [...state.history, { day, targetIds, containsWerewolf: result }],
  };
}
export function freshFragrantState(): FragrantState {
  return {
    policy: FRAGRANT_PAIR_POLICY,
    knownWolfId: null,
    knowledgeNight: null,
    lastChoice: null,
    bindings: [],
    trigger: null,
  };
}
export function readFragrantState(value: unknown): FragrantState | null {
  try {
    const v = snapshotPlainData(value, new Set(), 0, 65536);
    if (
      !exact(v, ["policy", "knownWolfId", "knowledgeNight", "lastChoice", "bindings", "trigger"]) ||
      v.policy !== FRAGRANT_PAIR_POLICY ||
      !Array.isArray(v.bindings)
    )
      return null;
    if (
      v.knownWolfId === null
        ? v.knowledgeNight !== null
        : !positive(v.knownWolfId) || v.knowledgeNight !== 1
    )
      return null;
    if (
      v.lastChoice !== null &&
      (!exact(v.lastChoice, ["day", "pairIds"]) ||
        !positive(v.lastChoice.day) ||
        (v.lastChoice.pairIds !== null && !pair(v.lastChoice.pairIds)))
    )
      return null;
    let previous = 0,
      pending = 0,
      triggered = 0;
    for (const b of v.bindings) {
      if (
        !exact(b, ["id", "createdNight", "expiresNight", "pairIds", "status"]) ||
        !positive(b.createdNight) ||
        b.createdNight <= previous ||
        b.expiresNight !== b.createdNight + 1 ||
        b.id !== `fragrant:night:${b.createdNight}` ||
        !pair(b.pairIds)
      )
        return null;
      previous = b.createdNight;
      if (exact(b.status, ["kind"]) && b.status.kind === "pending") pending++;
      else if (exact(b.status, ["kind", "day"]) && positive(b.status.day)) {
        if (b.status.kind === "expired" && b.status.day === b.expiresNight) {
        } else if (b.status.kind === "triggered" && b.status.day === b.createdNight) triggered++;
        else return null;
      } else return null;
    }
    if (pending > 1 || triggered > 1 || (pending && triggered)) return null;
    if (v.bindings.length && v.knowledgeNight !== 1) return null;
    if (
      pending &&
      (!exact(v.lastChoice, ["day", "pairIds"]) ||
        v.lastChoice.pairIds === null ||
        v.bindings.at(-1)?.status.kind !== "pending")
    )
      return null;
    if (
      triggered &&
      (v.bindings.at(-1)?.status.kind !== "triggered" ||
        !exact(v.lastChoice, ["day", "pairIds"]) ||
        v.lastChoice.day !== v.bindings.at(-1)?.createdNight)
    )
      return null;
    if (
      v.bindings.length &&
      (!v.lastChoice ||
        !exact(v.lastChoice, ["day", "pairIds"]) ||
        Number(v.lastChoice.day) < previous)
    )
      return null;
    if (v.bindings.length) {
      const latest = v.bindings.at(-1)!;
      if (!exact(v.lastChoice, ["day", "pairIds"])) return null;
      if (v.lastChoice.day === latest.createdNight) {
        if (
          v.lastChoice.pairIds === null ||
          JSON.stringify(v.lastChoice.pairIds) !== JSON.stringify(latest.pairIds)
        )
          return null;
      } else if (latest.status.kind !== "expired" || v.lastChoice.pairIds !== null) return null;
    } else if (
      v.lastChoice !== null &&
      exact(v.lastChoice, ["day", "pairIds"]) &&
      v.lastChoice.pairIds !== null
    )
      return null;
    if (v.trigger === null) {
      if (triggered) return null;
    } else {
      const r = v.trigger;
      if (
        !exact(r, ["bindingId", "day", "rootId", "addedTargetId"]) ||
        !positive(r.day) ||
        !positive(r.rootId) ||
        (r.addedTargetId !== null && !positive(r.addedTargetId))
      )
        return null;
      const b = v.bindings.find((b) => b.id === r.bindingId);
      if (
        !b ||
        triggered !== 1 ||
        b.status.kind !== "triggered" ||
        b.createdNight !== r.day ||
        !b.pairIds.includes(r.rootId) ||
        (r.addedTargetId !== null &&
          (r.addedTargetId === r.rootId || !b.pairIds.includes(r.addedTargetId)))
      )
        return null;
    }
    if (v.lastChoice !== null && v.knowledgeNight !== 1) return null;
    return v as unknown as FragrantState;
  } catch {
    return null;
  }
}
function valid(value: FragrantState): FragrantState {
  const s = readFragrantState(value);
  if (!s) throw Error("fragrant_state_invalid");
  return s;
}
export function commitKnownWolf(value: FragrantState, targetId: number): FragrantState {
  const s = valid(value);
  if (!positive(targetId) || s.knowledgeNight !== null)
    throw Error("fragrant_knowledge_already_committed");
  return { ...s, knownWolfId: targetId, knowledgeNight: 1 };
}
export function expireFragrantAtNightOpen(value: FragrantState, day: number): FragrantState {
  const s = valid(value);
  if (!positive(day) || (s.lastChoice && day <= s.lastChoice.day))
    throw Error("fragrant_night_invalid");
  return {
    ...s,
    bindings: s.bindings.map((b) =>
      b.status.kind === "pending" && b.expiresNight <= day
        ? { ...b, status: { kind: "expired" as const, day: b.expiresNight } }
        : b,
    ),
  };
}
export function chooseFragrantPair(
  value: FragrantState,
  day: number,
  targets: unknown,
): FragrantState {
  const s = valid(value);
  if (
    !positive(day) ||
    s.knowledgeNight !== 1 ||
    s.trigger ||
    s.bindings.some((b) => b.status.kind === "pending") ||
    (s.lastChoice && day <= s.lastChoice.day)
  )
    throw Error("fragrant_binding_unavailable");
  const pairIds = targets === null ? null : normalizePair(targets);
  return {
    ...s,
    lastChoice: { day, pairIds },
    bindings:
      pairIds === null
        ? s.bindings
        : [
            ...s.bindings,
            {
              id: `fragrant:night:${day}`,
              createdNight: day,
              expiresNight: day + 1,
              pairIds,
              status: { kind: "pending" },
            },
          ],
  };
}
/** Caller proves actual original-life deaths; this pure receipt never marks World or decides victory. */
export function triggerFragrantPair(
  value: FragrantState,
  day: number,
  rootId: number,
  addedTargetId: number | null,
): FragrantState {
  const s = valid(value),
    b = s.bindings.find((b) => b.status.kind === "pending");
  if (
    s.trigger ||
    !b ||
    day !== b.createdNight ||
    !b.pairIds.includes(rootId) ||
    (addedTargetId !== null && (addedTargetId === rootId || !b.pairIds.includes(addedTargetId)))
  )
    throw Error("fragrant_trigger_unavailable");
  return {
    ...s,
    bindings: s.bindings.map((row) =>
      row === b ? { ...row, status: { kind: "triggered" as const, day } } : row,
    ),
    trigger: { bindingId: b.id, day, rootId, addedTargetId },
  };
}
