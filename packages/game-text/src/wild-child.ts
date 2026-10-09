import { copyEventData } from "./event-data";
export const WILD_CHILD_EVENT_TYPES = [
  "wild_child_model_chosen",
  "wild_child_model_eliminated",
  "wild_child_transformed",
  "wild_child_pack_activated",
] as const;
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const keys = (p: Record<string, unknown>, fields: string[]) =>
  Object.keys(p).length === fields.length && fields.every((k) => Object.hasOwn(p, k));
export function readWildChildEventFact(
  type: string,
  payload: unknown,
): Record<string, unknown> | null {
  if (!(WILD_CHILD_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(payload) as Record<string, unknown>;
    if (!p || Array.isArray(p) || !positive(p.actorId) || !positive(p.day)) return null;
    if (type === "wild_child_model_chosen")
      return keys(p, ["actorId", "day", "targetId"]) &&
        p.day === 1 &&
        positive(p.targetId) &&
        p.actorId !== p.targetId
        ? p
        : null;
    if (type === "wild_child_model_eliminated")
      return keys(p, [
        "actorId",
        "targetId",
        "day",
        "phase",
        "deathCommit",
        "sources",
        "deadIds",
      ]) &&
        positive(p.targetId) &&
        p.actorId !== p.targetId &&
        ["night", "day", "voting"].includes(p.phase as string) &&
        typeof p.deathCommit === "string" &&
        p.deathCommit === `wild-model:${p.actorId}:${p.targetId}:${p.day}` &&
        Array.isArray(p.deadIds) &&
        p.deadIds.length > 0 &&
        p.deadIds.every(positive) &&
        p.deadIds.includes(p.targetId) &&
        new Set(p.deadIds).size === p.deadIds.length &&
        Array.isArray(p.sources) &&
        p.sources.length > 0 &&
        p.sources.every((s) =>
          ["wolf_kill", "poison", "shot", "exile", "self_destruct"].includes(s as string),
        ) &&
        new Set(p.sources).size === p.sources.length
        ? p
        : null;
    if (type === "wild_child_transformed")
      return keys(p, ["actorId", "day", "eligibleNight", "camp", "deathCommit"]) &&
        p.camp === "wolf" &&
        p.eligibleNight === (p.day as number) + 1 &&
        typeof p.deathCommit === "string" &&
        /^wild-model:[1-9]\d*:[1-9]\d*:[1-9]\d*$/.test(p.deathCommit) &&
        Number(p.deathCommit.split(":")[1]) === p.actorId &&
        Number(p.deathCommit.split(":")[3]) === p.day &&
        Number(p.deathCommit.split(":")[2]) !== p.actorId
        ? p
        : null;
    return keys(p, ["actorId", "day", "eligibleNight"]) &&
      positive(p.eligibleNight) &&
      (p.day as number) >= (p.eligibleNight as number)
      ? p
      : null;
  } catch {
    return null;
  }
}

/** Exact actor DTO; deliberately excludes God commit IDs, batch IDs and hidden causes. */
export function readWildChildPlayerFact(
  type: string,
  payload: unknown,
): Record<string, unknown> | null {
  if (type !== "wild_child_transformed")
    return type === "wild_child_model_eliminated" ? null : readWildChildEventFact(type, payload);
  try {
    const p = copyEventData(payload) as Record<string, unknown>;
    return p &&
      keys(p, ["actorId", "day", "eligibleNight", "camp"]) &&
      positive(p.actorId) &&
      positive(p.day) &&
      p.eligibleNight === (p.day as number) + 1 &&
      p.camp === "wolf"
      ? p
      : null;
  } catch {
    return null;
  }
}
