/**
 * 负责猎魔人的纯事件、自身历史和工具数据契约，保留原政策、可空字段及历史限额。
 * 输入为机器事件名称与已确认 inert 载荷；输出为原脱离事实、状态／工具数据或 null。
 * 公共声明唯一拥有数据形状，原可写性不加强；选择知识不含原体、租约或库存写句柄，
 * 数据合法不授予请求、生命或资源权限。实际状态、提交与封存仍归后端机制。
 * 本浏览器兼容 reader 不保证恶意 Proxy 零 trap；Node 入口须先拒绝，再调用原纯读取。
 */
import { copyEventData } from "../inert-event-data";
export const DEMON_HUNTER_POLICY = "awa_netease_demon_hunter_v1" as const;
export const DEMON_HUNTER_EVENT_TYPES = [
  "demon_hunter_chosen",
  "demon_hunter_cancelled",
  "demon_hunter_poison_immune",
] as const;
export interface DemonHunterChoiceFact {
  policy: typeof DEMON_HUNTER_POLICY;
  actorId: number;
  day: number;
  targetId: number | null;
}
export interface DemonHunterPlayerFact {
  policy: typeof DEMON_HUNTER_POLICY;
  day: number;
  targetId: number | null;
}
export interface DemonHunterCancelFact {
  policy: typeof DEMON_HUNTER_POLICY;
  actorId: number;
  day: number;
  targetId: number;
  reason: "authority_revoked";
  faultId: string | null;
}
export interface DemonHunterPoisonImmuneFact {
  policy: typeof DEMON_HUNTER_POLICY;
  actorId: number;
  day: number;
  witchId: number;
}
export type DemonHunterEventFact =
  DemonHunterChoiceFact | DemonHunterCancelFact | DemonHunterPoisonImmuneFact;
function keys(p: Record<string, unknown>, names: readonly string[]): boolean {
  return Object.keys(p).length === names.length && names.every((key) => Object.hasOwn(p, key));
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function data(payload: unknown): Record<string, unknown> | null {
  try {
    const p = copyEventData(payload);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
export function readDemonHunterEventFact(
  type: string,
  payload: unknown,
): DemonHunterEventFact | null {
  const p = data(payload);
  if (!p || p.policy !== DEMON_HUNTER_POLICY || !positive(p.actorId) || !positive(p.day))
    return null;
  if (type === "demon_hunter_poison_immune")
    return keys(p, ["policy", "actorId", "day", "witchId"]) &&
      positive(p.witchId) &&
      p.witchId !== p.actorId
      ? (p as unknown as DemonHunterPoisonImmuneFact)
      : null;
  if ((p.day as number) < 2) return null;
  if (type === "demon_hunter_chosen")
    return keys(p, ["policy", "actorId", "day", "targetId"]) &&
      (p.targetId === null || (positive(p.targetId) && p.targetId !== p.actorId))
      ? (p as unknown as DemonHunterChoiceFact)
      : null;
  if (type === "demon_hunter_cancelled")
    return keys(p, ["policy", "actorId", "day", "targetId", "reason", "faultId"]) &&
      positive(p.targetId) &&
      p.targetId !== p.actorId &&
      p.reason === "authority_revoked" &&
      (p.faultId === null ||
        (typeof p.faultId === "string" && p.faultId.length > 0 && p.faultId.length <= 128))
      ? (p as unknown as DemonHunterCancelFact)
      : null;
  return null;
}
/** 仅玩家自身选择；不含来源、免疫结果、撤销原因、行动者身份或目标阵营。 */
export function readDemonHunterPlayerFact(
  type: string,
  payload: unknown,
): DemonHunterPlayerFact | null {
  const p = data(payload);
  return type === "demon_hunter_chosen" &&
    !!p &&
    keys(p, ["policy", "day", "targetId"]) &&
    p.policy === DEMON_HUNTER_POLICY &&
    positive(p.day) &&
    p.day >= 2 &&
    (p.targetId === null || positive(p.targetId))
    ? (p as unknown as DemonHunterPlayerFact)
    : null;
}

/** 保留原可写选择行；它只描述已记录知识，不授予目标资格、原生命或请求许可。 */
export interface DemonHunterChoice {
  day: number;
  targetId: number | null;
}
export interface DemonHunterState {
  policy: typeof DEMON_HUNTER_POLICY;
  history: DemonHunterChoice[];
}
export interface DemonHuntTool {
  name: "demon_hunt";
  args: { target_id: number | null; abstain: boolean };
}
export function readDemonHunterState(value: unknown): DemonHunterState | null {
  const p = data(value);
  if (
    !p ||
    !keys(p, ["policy", "history"]) ||
    p.policy !== DEMON_HUNTER_POLICY ||
    !Array.isArray(p.history)
  )
    return null;
  let previous = 1;
  for (const row of p.history) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      !keys(row, ["day", "targetId"]) ||
      !positive(row.day) ||
      row.day <= previous ||
      (row.targetId !== null && !positive(row.targetId))
    )
      return null;
    previous = row.day;
  }
  return p as unknown as DemonHunterState;
}
export function readDemonHuntTool(value: unknown): DemonHuntTool | null {
  const p = data(value);
  if (
    !p ||
    !keys(p, ["name", "args"]) ||
    p.name !== "demon_hunt" ||
    !p.args ||
    typeof p.args !== "object" ||
    Array.isArray(p.args)
  )
    return null;
  const args = p.args as Record<string, unknown>;
  return keys(args, ["target_id", "abstain"]) &&
    (args.target_id === null
      ? args.abstain === true
      : positive(args.target_id) && args.abstain === false)
    ? (p as unknown as DemonHuntTool)
    : null;
}
