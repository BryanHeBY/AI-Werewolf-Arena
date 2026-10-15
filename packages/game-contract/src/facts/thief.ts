/**
 * 负责盗贼初始牌组及身份选择的共享事实格式。输入为事件标识和已确认的惰性数据，输出按原精确键集和牌组／选择关联校验的复制结构，或 null。
 * 历史 role／camp 标签记录该次选择，不证明当前 World 已安装同一身份；读取不重新发牌、支付库存或授权首夜提交。
 * 复制／校验异常返回 null，反射可能执行 Proxy trap，Node 入口须另行拒绝危险对象。
 */
import { copyEventData } from "../inert-event-data";
import type { RoleId } from "../role-ids";
export const THIEF_EVENT_TYPES = ["thief_initial_deal", "thief_identity_chosen"] as const;
const roles: readonly RoleId[] = [
  "thief",
  "wolf",
  "villager",
  "seer",
  "witch",
  "hunter",
  "guard",
  "idiot",
];
const policy = "lui_meme_thief_two_extra_villagers_v1";
function keys(p: Record<string, unknown>, required: string[]) {
  return Object.keys(p).length === required.length && required.every((k) => Object.hasOwn(p, k));
}
// slot 为 null 的保留身份分支与选取 0／1 号牌分支分别关联 role／camp，不写回真实库存。
export function readThiefEventFact(type: string, payload: unknown): Record<string, unknown> | null {
  if (!(THIEF_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(payload, 130) as Record<string, unknown>;
    if (!p || Array.isArray(p) || p.policy !== policy) return null;
    if (type === "thief_initial_deal") {
      if (
        !keys(p, ["policy", "roles", "boardSize"]) ||
        !Number.isSafeInteger(p.boardSize) ||
        (p.boardSize as number) < 3 ||
        (p.boardSize as number) > 128 ||
        !Array.isArray(p.roles) ||
        p.roles.length !== (p.boardSize as number) + 2 ||
        !p.roles.every((role) => roles.includes(role as RoleId)) ||
        p.roles.filter((role) => role === "thief").length !== 1 ||
        p.roles.filter((role) => role === "wolf").length < 2 ||
        p.roles.filter((role) => role !== "wolf" && role !== "thief").length < 4
      )
        return null;
    } else {
      if (
        !keys(p, ["policy", "actorId", "day", "slot", "role", "camp"]) ||
        !Number.isSafeInteger(p.actorId) ||
        (p.actorId as number) < 1 ||
        p.day !== 1 ||
        !roles.includes(p.role as RoleId) ||
        ![0, 1, null].includes(p.slot as number | null) ||
        (p.slot === null) !== (p.role === "thief") ||
        p.camp !== (p.role === "wolf" ? "wolf" : "good")
      )
        return null;
    }
    return p;
  } catch {
    return null;
  }
}
