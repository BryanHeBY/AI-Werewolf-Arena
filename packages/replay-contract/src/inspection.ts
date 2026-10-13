/**
 * 负责已记录查验的严格读取及既有布尔历史兼容。输入为纯数据结果／旧 payload，输出已知查验 DTO 或 null。
 * 结构类型归 game-contract；字段访问器不被当作已记录值，未知标签不推断好人，不查询真实角色或授予许可。
 */
import {
  isRoleId,
  type InspectionCamp,
  type InspectionResult,
} from "@ai-werewolf-arena/game-contract";
import { isRecord } from "./validation";

const isCamp = (value: unknown): value is InspectionCamp =>
  value === "good" || value === "wolf" || value === "third_party";

/** 读取已知查验，不把未来／畸形标签解释成好人。 */
export function readInspectionResult(value: unknown): InspectionResult | null {
  try {
    if (!isRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Reflect.ownKeys(descriptors);
    if (names.some((name) => typeof name !== "string")) return null;
    const keys = (names as string[]).sort().join(",");
    // 不执行外来字段访问器，返回值与已校验的同一描述符值保持一致；
    // Proxy 描述符反射抛错仍走原拒绝，不承诺所有外来对象零 trap。
    const data = (key: string): unknown => {
      const descriptor = descriptors[key];
      return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
    };
    const kind = data("kind"),
      camp = data("camp"),
      role = data("role");
    if (kind === "camp" && keys === "camp,kind" && isCamp(camp)) return { kind, camp };
    if (kind === "role" && keys === "kind,role" && isRoleId(role)) return { kind, role };
    if (kind === "combined" && keys === "camp,kind,role" && isCamp(camp) && isRoleId(role))
      return { kind, camp, role };
  } catch {
    /* 非普通值不被当作已序列化查验证据。 */
  }
  return null;
}

/** 仅在没有已记录 typed result 字段时使用历史布尔值。 */
export function readSeerInspectionResult(
  payload: Record<string, unknown>,
): InspectionResult | null {
  try {
    const result = Object.getOwnPropertyDescriptor(payload, "result");
    if (result) return Object.hasOwn(result, "value") ? readInspectionResult(result.value) : null;
    const legacy = Object.getOwnPropertyDescriptor(payload, "isWerewolf");
    const isWerewolf = legacy && Object.hasOwn(legacy, "value") ? legacy.value : undefined;
    return typeof isWerewolf === "boolean"
      ? { kind: "camp", camp: isWerewolf ? "wolf" : "good" }
      : null;
  } catch {
    return null;
  }
}
