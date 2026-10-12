/**
 * Owns pure Debate speech, ballot and resolved count contracts for wire consumers.
 * Inputs are identifiers and proven inert payload data; outputs are detached
 * shapes or null with original keys, limits, defaults and scalar correlations.
 * For these inputs the reader never changes rules, resources, phases or action
 * authority. Proxy reflection safety belongs to Node ingress before calling;
 * browser consumers must supply inert data rather than arbitrary JS objects.
 */
import { copyEventData } from "../inert-event-data";
export const DEBATE_EVENT_TYPES = [
  "debater_revealed",
  "debate_started",
  "debate_speech",
  "debate_resolved",
  "debate_canceled",
  "debate_ballots_recorded",
] as const;
export function readDebateEventFact(type: string, value: unknown): Record<string, unknown> | null {
  if (!(DEBATE_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(value) as Record<string, unknown>;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const positive = (n: unknown): n is number =>
      typeof n === "number" && Number.isSafeInteger(n) && n > 0;
    const count = (n: unknown): n is number =>
      typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
    const keys = (names: string[]) =>
      Object.keys(p).length === names.length && Object.keys(p).every((k) => names.includes(k));
    if (!positive(p.actorId)) return null;
    if (type === "debate_speech")
      return keys(["actorId", "text"]) && typeof p.text === "string" ? p : null;
    if (!positive(p.day)) return null;
    if (type === "debater_revealed") return keys(["actorId", "day"]) ? p : null;
    if (!positive(p.targetId) || p.actorId === p.targetId) return null;
    if (type === "debate_started") return keys(["actorId", "targetId", "day"]) ? p : null;
    if (type === "debate_canceled")
      return keys(["actorId", "targetId", "day", "reason"]) && p.reason === "scope_changed"
        ? p
        : null;
    if (!positive(p.eligibleCount) || p.eligibleCount < 2 || p.eligibleCount > 128) return null;
    if (type === "debate_ballots_recorded") {
      if (
        !keys(["actorId", "targetId", "day", "eligibleCount", "ballots"]) ||
        !Array.isArray(p.ballots) ||
        p.ballots.length !== p.eligibleCount
      )
        return null;
      const ids = new Set<number>();
      for (const b of p.ballots) {
        if (
          !b ||
          typeof b !== "object" ||
          Array.isArray(b) ||
          Object.keys(b).length !== 2 ||
          !Object.hasOwn(b, "voterId") ||
          !Object.hasOwn(b, "support") ||
          !positive(b.voterId) ||
          ids.has(b.voterId) ||
          !(b.support === null || typeof b.support === "boolean")
        )
          return null;
        ids.add(b.voterId);
      }
      return ids.has(p.actorId) && ids.has(p.targetId) ? p : null;
    }
    return keys([
      "actorId",
      "targetId",
      "day",
      "eligibleCount",
      "supports",
      "rejects",
      "abstentions",
      "success",
      "blockedId",
    ]) &&
      count(p.supports) &&
      count(p.rejects) &&
      count(p.abstentions) &&
      p.supports + p.rejects + p.abstentions === p.eligibleCount &&
      typeof p.success === "boolean" &&
      p.success === p.supports > p.eligibleCount / 2 &&
      p.blockedId === (p.success ? p.targetId : p.actorId)
      ? p
      : null;
  } catch {
    return null;
  }
}
