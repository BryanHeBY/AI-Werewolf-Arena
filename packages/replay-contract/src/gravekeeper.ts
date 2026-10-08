import type { InspectionResult } from "@ai-werewolf-arena/game-catalog";
import { readInspectionResult } from "./inspection";
import { isRecord } from "./validation";

export interface GravekeeperReport {
  exileDay: number;
  receivedDay: number;
  targetId: number;
  result: Extract<InspectionResult, { kind: "camp" }>;
}
export interface GravekeeperFeedback extends GravekeeperReport { actorId: number }
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/** Exact camp-only facts. Never execute an accessor or infer Good from a malformed result. */
function read(value: unknown, actor: boolean): GravekeeperFeedback | GravekeeperReport | null {
  try {
    if (!isRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    const expected = actor ? "actorId,exileDay,receivedDay,result,targetId" : "exileDay,receivedDay,result,targetId";
    if (keys.some(key => typeof key !== "string") || (keys as string[]).sort().join(",") !== expected) return null;
    if (Object.values(descriptors).some(descriptor => !descriptor.enumerable || !Object.hasOwn(descriptor, "value"))) return null;
    const data = (key: string): unknown => descriptors[key]?.value;
    const exileDay = data("exileDay"), receivedDay = data("receivedDay"), targetId = data("targetId"), actorId = data("actorId"), result = readInspectionResult(data("result"));
    if (!positiveId(exileDay) || !positiveId(receivedDay) || receivedDay !== exileDay + 1 || !positiveId(targetId) || result?.kind !== "camp" || (actor && !positiveId(actorId))) return null;
    const report: GravekeeperReport = { exileDay, receivedDay, targetId, result };
    return actor ? { ...report, actorId: actorId as number } : report;
  } catch { return null; }
}
export function readGravekeeperReport(value: unknown): GravekeeperReport | null { return read(value, false); }
export function readGravekeeperFeedback(value: unknown): GravekeeperFeedback | null { return read(value, true) as GravekeeperFeedback | null; }
