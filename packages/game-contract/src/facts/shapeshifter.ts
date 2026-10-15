/**
 * 负责千面人初始牌组、身份选择事实及选择工具的共享格式。输入为事件／工具标识和已确认的惰性数据，输出复制后的合法结构或 null。
 * 原精确字段、牌组数量及身份／阵营关联保持；读取不重新发牌、消耗保留牌或替代首夜窗口授权。
 * 复制／校验异常返回 null，Proxy 反射可能执行 trap；Node 入口须独立拒绝危险对象。
 */
import { copyEventData } from "../inert-event-data";
import type { RoleId } from "../role-ids";
export const SHAPESHIFTER_EVENT_TYPES = [
  "shapeshifter_initial_deal",
  "shapeshifter_identity_chosen",
] as const;
const roles: readonly RoleId[] = [
  "shapeshifter",
  "wolf",
  "villager",
  "seer",
  "witch",
  "hunter",
  "guard",
  "idiot",
];
const policy = "awa_netease_shapeshifter_two_extra_villagers_v1";
function keys(p: Record<string, unknown>, required: string[]) {
  return Object.keys(p).length === required.length && required.every((k) => Object.hasOwn(p, k));
}
export function readShapeshifterEventFact(
  type: string,
  payload: unknown,
): Record<string, unknown> | null {
  if (!(SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(payload, 130) as Record<string, unknown>;
    if (!p || Array.isArray(p) || p.policy !== policy) return null;
    if (type === "shapeshifter_initial_deal") {
      if (
        !keys(p, ["policy", "roles", "boardSize"]) ||
        !Number.isSafeInteger(p.boardSize) ||
        (p.boardSize as number) < 6 ||
        (p.boardSize as number) > 128 ||
        !Array.isArray(p.roles) ||
        p.roles.length !== (p.boardSize as number) + 2 ||
        !p.roles.every((role) => roles.includes(role as RoleId)) ||
        p.roles.filter((role) => role === "shapeshifter").length !== 1 ||
        p.roles.filter((role) => role === "wolf").length < 2 ||
        p.roles.filter((role) => role !== "wolf" && role !== "shapeshifter").length < 3
      )
        return null;
    } else {
      if (
        !keys(p, ["policy", "actorId", "day", "slot", "role", "camp"]) ||
        !Number.isSafeInteger(p.actorId) ||
        (p.actorId as number) < 1 ||
        p.day !== 1 ||
        !roles.includes(p.role as RoleId) ||
        ![0, 1].includes(p.slot as number) ||
        p.role === "shapeshifter" ||
        p.camp !== (p.role === "wolf" ? "wolf" : "good")
      )
        return null;
    }
    return p;
  } catch {
    return null;
  }
}

/** 引擎与归档共用的精确工具格式读取；只解析原工具名／参数，不消耗牌或授予提交权限。 */
export function readShapeshifterChoiceTool(
  value: unknown,
): { name: "choose_shapeshifter_card"; args: { slot: 0 | 1 } } | null {
  try {
    const p = copyEventData(value) as Record<string, unknown>;
    if (
      !p ||
      Array.isArray(p) ||
      !keys(p, ["name", "args"]) ||
      p.name !== "choose_shapeshifter_card"
    )
      return null;
    const args = p.args as Record<string, unknown>;
    if (
      !args ||
      Array.isArray(args) ||
      !keys(args, ["slot"]) ||
      (args.slot !== 0 && args.slot !== 1)
    )
      return null;
    return { name: "choose_shapeshifter_card", args: { slot: args.slot } };
  } catch {
    return null;
  }
}
