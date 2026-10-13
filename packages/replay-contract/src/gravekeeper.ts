/**
 * 负责守墓反馈归档的结构读取。输入为纯数据事实，输出带明确阵营查验的报告／反馈或 null；共享类型归 game-contract。
 * 字段按描述符读取，不用畸形结果补造好人，不修改输入或查询 World；外来反射异常保持原拒绝边界。
 */
import type { InspectionResult } from "@ai-werewolf-arena/game-contract";
import { readInspectionResult } from "./inspection";
import { isRecord } from "./validation";

export interface GravekeeperReport {
  exileDay: number;
  receivedDay: number;
  targetId: number;
  result: Extract<InspectionResult, { kind: "camp" }>;
}
export interface GravekeeperFeedback extends GravekeeperReport {
  actorId: number;
}
const positiveId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

/** 严格阵营反馈：按描述符读值，不执行字段访问器，不把畸形结果补成好人。 */
function read(value: unknown, actor: boolean): GravekeeperFeedback | GravekeeperReport | null {
  try {
    if (!isRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value),
      keys = Reflect.ownKeys(descriptors);
    const expected = actor
      ? "actorId,exileDay,receivedDay,result,targetId"
      : "exileDay,receivedDay,result,targetId";
    if (
      keys.some((key) => typeof key !== "string") ||
      (keys as string[]).sort().join(",") !== expected
    )
      return null;
    if (
      Object.values(descriptors).some(
        (descriptor) => !descriptor.enumerable || !Object.hasOwn(descriptor, "value"),
      )
    )
      return null;
    const data = (key: string): unknown => descriptors[key]?.value;
    const exileDay = data("exileDay"),
      receivedDay = data("receivedDay"),
      targetId = data("targetId"),
      actorId = data("actorId"),
      result = readInspectionResult(data("result"));
    if (
      !positiveId(exileDay) ||
      !positiveId(receivedDay) ||
      receivedDay !== exileDay + 1 ||
      !positiveId(targetId) ||
      result?.kind !== "camp" ||
      (actor && !positiveId(actorId))
    )
      return null;
    const report: GravekeeperReport = { exileDay, receivedDay, targetId, result };
    return actor ? { ...report, actorId: actorId as number } : report;
  } catch {
    return null;
  }
}
export function readGravekeeperReport(value: unknown): GravekeeperReport | null {
  return read(value, false);
}
export function readGravekeeperFeedback(value: unknown): GravekeeperFeedback | null {
  return read(value, true) as GravekeeperFeedback | null;
}
