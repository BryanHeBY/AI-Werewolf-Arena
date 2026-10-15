/**
 * 负责孤独少女的选择事实、历史可选阵营字段及工具输入格式。输入为标识和已确认的惰性数据，输出脱离引用的合法结构或 null。
 * 精确键集与标量关联在此校验，camp 缺省仍是原允许格式；数据读取不复制真实阵营、不授予目标资格或建立胜利关系。
 * 复制／校验异常返回 null，反射可能执行 Proxy trap；调用方入口须约束对象来源。
 */
import { copyEventData } from "../inert-event-data";
export const LONELY_GIRL_POLICY = "awa_netease_lonely_girl_v1" as const;
export const LONELY_GIRL_EVENT_TYPES = ["lonely_girl_admired_chosen"] as const;
// camp 是历史事实的可选披露字段，省略仍合法；存在时只接受原 good／wolf 值。
export interface LonelyGirlChoiceFact {
  policy: typeof LONELY_GIRL_POLICY;
  actorId: number;
  day: 1;
  targetId: number;
  camp?: "good" | "wolf";
}
function keys(p: Record<string, unknown>, names: string[]) {
  return Object.keys(p).length === names.length && names.every((k) => Object.hasOwn(p, k));
}
export function readLonelyGirlEventFact(
  type: string,
  payload: unknown,
): LonelyGirlChoiceFact | null {
  if (type !== "lonely_girl_admired_chosen") return null;
  try {
    const p = copyEventData(payload) as Record<string, unknown>;
    if (
      !p ||
      Array.isArray(p) ||
      !keys(
        p,
        Object.hasOwn(p, "camp")
          ? ["policy", "actorId", "day", "targetId", "camp"]
          : ["policy", "actorId", "day", "targetId"],
      ) ||
      p.policy !== LONELY_GIRL_POLICY ||
      p.day !== 1 ||
      !Number.isSafeInteger(p.actorId) ||
      (p.actorId as number) < 1 ||
      !Number.isSafeInteger(p.targetId) ||
      (p.targetId as number) < 1 ||
      p.actorId === p.targetId ||
      (Object.hasOwn(p, "camp") && p.camp !== "good" && p.camp !== "wolf")
    )
      return null;
    return p as unknown as LonelyGirlChoiceFact;
  } catch {
    return null;
  }
}
export function readLonelyGirlChoiceTool(
  value: unknown,
): { name: "choose_admired_player"; args: { target_id: number } } | null {
  try {
    const p = copyEventData(value) as Record<string, unknown>,
      a = p?.args as Record<string, unknown>;
    return p &&
      !Array.isArray(p) &&
      keys(p, ["name", "args"]) &&
      p.name === "choose_admired_player" &&
      a &&
      !Array.isArray(a) &&
      keys(a, ["target_id"]) &&
      Number.isSafeInteger(a.target_id) &&
      (a.target_id as number) > 0
      ? { name: "choose_admired_player", args: { target_id: a.target_id as number } }
      : null;
  } catch {
    return null;
  }
}
