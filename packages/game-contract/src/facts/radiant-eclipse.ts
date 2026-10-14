/**
 * 负责流光伯爵／蚀日侍女事件事实及蚀日侍女历史的公共纯数据结构与 inert reader。
 * 输入为机器事件类型和无 reviver 的 JSON.parse／已确认 inert 载荷；输出为原脱离事实／null。
 * 数据 owner 保留复制、可空字段和可见性规则，不授予行动、不保存 live 能力、原体或租约。
 * history 的 abilityId 只是原串 ID；吞噬／抑制／借用许可仍归后端。浏览器反射可能触发
 * Proxy trap，恶意对象的预先拒绝仍归 Node 准入，不因公共类型新增 schema 或组合。
 */
import { copyEventData } from "../inert-event-data";

/** 原有限五角色纯联合；真实目标白名单与当前性仍由后端原 runtime 数组／权威判定。 */
export type EclipseSwallowedRole = "villager" | "seer" | "witch" | "dreamer" | "radiant_count";
/** 原可写吞噬 history；空过／村民可无 abilityId，不含所借能力 payload 或原生命句柄。 */
export interface EclipseState {
  policy: "awa_radiant_eclipse_v1";
  history: Array<{
    day: number;
    targetId: number | null;
    roleId: EclipseSwallowedRole | null;
    abilityId: string | null;
  }>;
}

export const RADIANT_ECLIPSE_EVENT_TYPES = Object.freeze([
  "eclipse_swallowed",
  "eclipse_native_suppressed",
  "eclipse_native_restored",
  "eclipse_lease_closed",
  "radiant_shelter_chosen",
] as const);
export type RadiantEclipseFact =
  | {
      actorId: number;
      day: number;
      targetId: number | null;
      roleId: "villager" | "seer" | "witch" | "dreamer" | "radiant_count" | null;
      abilityId: string | null;
    }
  | { playerId: number; day: number }
  | {
      actorId: number;
      day: number;
      targetId: number | null;
      abilityId: string | null;
      status: "committed" | "aborted";
    }
  | { actorId: number; day: number; targetId: number | null; abilityId: string };
function id(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}
function exact(p: Record<string, unknown>, keys: string[]) {
  return Object.keys(p).length === keys.length && keys.every((k) => Object.hasOwn(p, k));
}
export function readRadiantEclipseFact(type: string, value: unknown): RadiantEclipseFact | null {
  if (!(RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const copied = copyEventData(value);
    if (!copied || typeof copied !== "object" || Array.isArray(copied)) return null;
    const p = copied as Record<string, unknown>;
    if (!id(p.day)) return null;
    if (type === "eclipse_native_suppressed" || type === "eclipse_native_restored")
      return exact(p, ["playerId", "day"]) && p.day >= 2 && id(p.playerId)
        ? (p as unknown as RadiantEclipseFact)
        : null;
    if (!id(p.actorId) || (p.targetId !== null && !id(p.targetId))) return null;
    if (type === "eclipse_lease_closed")
      return exact(p, ["actorId", "day", "targetId", "abilityId", "status"]) &&
        ["committed", "aborted"].includes(p.status as string) &&
        p.targetId !== p.actorId &&
        (p.targetId !== null || p.abilityId === null) &&
        (p.day !== 1 || (p.targetId === null && p.abilityId === null)) &&
        (p.abilityId === null || p.abilityId === `copy:eclipse:night:${p.day}`)
        ? (p as unknown as RadiantEclipseFact)
        : null;
    if (p.day < 2) return null;
    if (type === "radiant_shelter_chosen")
      return exact(p, ["actorId", "day", "targetId", "abilityId"]) &&
        p.targetId !== p.actorId &&
        (p.abilityId === "native:shelter" || p.abilityId === `copy:eclipse:night:${p.day}`)
        ? (p as unknown as RadiantEclipseFact)
        : null;
    if (!exact(p, ["actorId", "day", "targetId", "roleId", "abilityId"])) return null;
    if (p.targetId === null)
      return p.roleId === null && p.abilityId === null
        ? (p as unknown as RadiantEclipseFact)
        : null;
    return p.targetId !== p.actorId &&
      ["villager", "seer", "witch", "dreamer", "radiant_count"].includes(p.roleId as string) &&
      (p.roleId === "villager"
        ? p.abilityId === null
        : p.abilityId === `copy:eclipse:night:${p.day}`)
      ? (p as unknown as RadiantEclipseFact)
      : null;
  } catch {
    return null;
  }
}
export function radiantEclipseAudience(type: string, fact: RadiantEclipseFact): readonly number[] {
  return type === "eclipse_lease_closed" ? [] : ["playerId" in fact ? fact.playerId : fact.actorId];
}
