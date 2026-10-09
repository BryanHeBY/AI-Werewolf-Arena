import { copyEventData } from "./event-data";
/** Strict inert source facts shared by engine text and replay association. */
export const CUPID_EVENT_TYPES = [
  "cupid_lovers_chosen",
  "lover_recognized",
  "cupid_relation_resolved",
  "lovers_death",
] as const;
export function readCupidEventFact(type: string, value: unknown): Record<string, unknown> | null {
  if (!(CUPID_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(value, 4) as Record<string, unknown>;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const positive = (id: unknown): id is number =>
      typeof id === "number" && Number.isSafeInteger(id) && id > 0;
    const keys = (allowed: string[]) =>
      Object.keys(p).length === allowed.length &&
      Object.keys(p).every((key) => allowed.includes(key));
    if (!positive(p.actorId)) return null;
    if (type === "lover_recognized")
      return keys(["actorId", "partnerId"]) && positive(p.partnerId) && p.partnerId !== p.actorId
        ? p
        : null;
    if (type === "lovers_death")
      return keys(["actorId", "targetId"]) && positive(p.targetId) && p.targetId !== p.actorId
        ? p
        : null;
    if (
      p.day !== 1 ||
      !Array.isArray(p.pairIds) ||
      p.pairIds.length !== 2 ||
      !p.pairIds.every(positive) ||
      p.pairIds[0] === p.pairIds[1]
    )
      return null;
    if (type === "cupid_lovers_chosen") return keys(["actorId", "day", "pairIds"]) ? p : null;
    return keys(["actorId", "day", "policy", "pairIds", "pairCamps", "groupId", "mixed"]) &&
      ["netease_2017_cupid_follows_lovers_v1", "lui_meme_lovers_only_v1"].includes(
        p.policy as string,
      ) &&
      p.groupId === "cupid_lovers" &&
      Array.isArray(p.pairCamps) &&
      p.pairCamps.length === 2 &&
      p.pairCamps.every((camp) => camp === "good" || camp === "wolf") &&
      p.mixed === (p.pairCamps[0] !== p.pairCamps[1])
      ? p
      : null;
  } catch {
    return null;
  }
}
