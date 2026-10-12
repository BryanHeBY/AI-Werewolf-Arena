/**
 * Owns pure animal-dream facts, knowledge shapes and their inert-data readers.
 * Inputs are original event identifiers and JSON.parse/no-reviver or proven
 * inert payloads; outputs preserve exact copied shapes, null rejection, limits
 * and visibility classifications. These facts never authorize actions or write
 * domain resources/state. Node ingress must reject hostile Proxy objects before
 * shared reflection; this browser-compatible module supplies no runtime handles.
 */
import { copyEventData } from "../inert-event-data";
import { ANIMAL_DREAM_POLICY } from "../board-policy-identifiers";
type Base = { policy: typeof ANIMAL_DREAM_POLICY; day: number };
type Actor = Base & { actorId: number };
export interface AnimalBeautyKnowledge {
  charmAllowed: boolean;
  linkAllowed: boolean;
  targetId: number | null;
  lastActedDay: number | null;
  history: Array<{ day: number; targetId: number | null }>;
}
export interface AnimalDreamPayloadMap {
  animal_night_opened: Base;
  animal_fox_chosen: Actor & { targetId: number | null };
  animal_fox_effect: Actor & { targetId: number; knifeBlocked: boolean; beautyBlocked: boolean };
  animal_knife_notified: Actor & { eligible: boolean };
  animal_beauty_notified: Actor & AnimalBeautyKnowledge;
  animal_cat_revealed: Actor;
  animal_puffer_revealed: Actor & { reason: "retaliation" | "knife_death" };
  animal_puffer_decided: Actor & { activate: boolean };
  animal_puffer_targets: Actor & { targetIds: number[]; round: 1 | 2 };
  animal_wave_prepared: Base & {
    phase: "night" | "day" | "voting";
    proposedIds: number[];
    blockedCatId: number | null;
  };
  animal_wave_committed: Base & {
    phase: "night" | "day" | "voting";
    deaths: number[];
    deathSources: Record<string, string[]>;
  };
  animal_cat_expiry_prepared: Actor & { unit: number; unitKind: "exile" | "skipped_day" };
  animal_unit_completed: Base & { unit: number; kind: "exile" | "skipped_day" };
}
export type AnimalDreamEventType = keyof AnimalDreamPayloadMap;
export type AnimalDreamFact = {
  [K in AnimalDreamEventType]: { type: K; payload: AnimalDreamPayloadMap[K] };
}[AnimalDreamEventType];
export const ANIMAL_DREAM_EVENT_TYPES = Object.freeze([
  "animal_night_opened",
  "animal_fox_chosen",
  "animal_fox_effect",
  "animal_knife_notified",
  "animal_beauty_notified",
  "animal_cat_revealed",
  "animal_puffer_revealed",
  "animal_puffer_decided",
  "animal_puffer_targets",
  "animal_wave_prepared",
  "animal_wave_committed",
  "animal_cat_expiry_prepared",
  "animal_unit_completed",
] as const satisfies readonly AnimalDreamEventType[]);
const id = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: unknown, fields: readonly string[]): v is Record<string, unknown> =>
  record(v) && Object.keys(v).length === fields.length && fields.every((k) => Object.hasOwn(v, k));
const ids = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length <= 12 && v.every(id) && new Set(v).size === v.length;
const base = ["policy", "day"];
const actor = [...base, "actorId"];
export function readAnimalDreamFact(type: string, value: unknown): AnimalDreamFact | null {
  if (!(ANIMAL_DREAM_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const v = copyEventData(value, 65536);
    if (!record(v) || v.policy !== ANIMAL_DREAM_POLICY || !id(v.day)) return null;
    if (
      type !== "animal_night_opened" &&
      !["animal_wave_prepared", "animal_wave_committed", "animal_unit_completed"].includes(type) &&
      !id(v.actorId)
    )
      return null;
    const historyRows = Array.isArray(v.history) ? v.history : [],
      sourceRecord = record(v.deathSources) ? v.deathSources : {};
    let valid = false;
    switch (type) {
      case "animal_night_opened":
        valid = exact(v, base);
        break;
      case "animal_fox_chosen":
        valid =
          exact(v, [...actor, "targetId"]) && (v.targetId === null || id(v.targetId)) && v.day >= 2;
        break;
      case "animal_fox_effect":
        valid =
          exact(v, [...actor, "targetId", "knifeBlocked", "beautyBlocked"]) &&
          id(v.targetId) &&
          typeof v.knifeBlocked === "boolean" &&
          typeof v.beautyBlocked === "boolean" &&
          v.day >= 2;
        break;
      case "animal_knife_notified":
        valid = exact(v, [...actor, "eligible"]) && typeof v.eligible === "boolean";
        break;
      case "animal_beauty_notified":
        valid =
          exact(v, [
            ...actor,
            "charmAllowed",
            "linkAllowed",
            "targetId",
            "lastActedDay",
            "history",
          ]) &&
          typeof v.charmAllowed === "boolean" &&
          typeof v.linkAllowed === "boolean" &&
          (v.targetId === null || id(v.targetId)) &&
          (v.lastActedDay === null || id(v.lastActedDay)) &&
          Array.isArray(v.history) &&
          v.history.every(
            (r, i) =>
              exact(r, ["day", "targetId"]) &&
              id(r.day) &&
              r.day <= Number(v.day) &&
              (i === 0 || r.day > Number(historyRows[i - 1].day)) &&
              (r.targetId === null || id(r.targetId)),
          );
        break;
      case "animal_cat_revealed":
        valid = exact(v, actor);
        break;
      case "animal_puffer_revealed":
        valid =
          exact(v, [...actor, "reason"]) &&
          ["retaliation", "knife_death"].includes(v.reason as string);
        break;
      case "animal_puffer_decided":
        valid = exact(v, [...actor, "activate"]) && typeof v.activate === "boolean";
        break;
      case "animal_puffer_targets":
        valid =
          exact(v, [...actor, "targetIds", "round"]) &&
          ids(v.targetIds) &&
          v.targetIds.length > 0 &&
          (v.round === 1 || v.round === 2);
        break;
      case "animal_wave_prepared":
        valid =
          exact(v, [...base, "phase", "proposedIds", "blockedCatId"]) &&
          ["night", "day", "voting"].includes(v.phase as string) &&
          ids(v.proposedIds) &&
          (v.blockedCatId === null || id(v.blockedCatId));
        break;
      case "animal_wave_committed":
        valid =
          exact(v, [...base, "phase", "deaths", "deathSources"]) &&
          ["night", "day", "voting"].includes(v.phase as string) &&
          ids(v.deaths) &&
          record(v.deathSources) &&
          Object.keys(v.deathSources).length === v.deaths.length &&
          v.deaths.every(
            (id) =>
              Array.isArray(sourceRecord[String(id)]) &&
              (sourceRecord[String(id)] as unknown[]).length > 0 &&
              (sourceRecord[String(id)] as unknown[]).every((c) =>
                [
                  "wolf_kill",
                  "exile",
                  "charm",
                  "self_destruct",
                  "puffer_retaliation",
                  "white_cat_expiry",
                ].includes(c as string),
              ),
          );
        break;
      case "animal_cat_expiry_prepared":
        valid =
          exact(v, [...actor, "unit", "unitKind"]) &&
          id(v.unit) &&
          ["exile", "skipped_day"].includes(v.unitKind as string);
        break;
      case "animal_unit_completed":
        valid =
          exact(v, [...base, "unit", "kind"]) &&
          id(v.unit) &&
          ["exile", "skipped_day"].includes(v.kind as string);
        break;
    }
    return valid ? ({ type, payload: v } as AnimalDreamFact) : null;
  } catch {
    return null;
  }
}
export function animalDreamFactAudience(type: AnimalDreamEventType): "public" | "actor" | "god" {
  if (["animal_cat_revealed", "animal_puffer_revealed"].includes(type)) return "public";
  if (
    [
      "animal_fox_chosen",
      "animal_knife_notified",
      "animal_beauty_notified",
      "animal_puffer_decided",
    ].includes(type)
  )
    return "actor";
  return "god";
}
