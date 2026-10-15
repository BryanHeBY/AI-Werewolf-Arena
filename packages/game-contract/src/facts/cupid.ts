/**
 * 负责丘比特配对、相认及关系结果的共享事实格式。输入为事件标识和已确认的惰性数据，输出脱离原引用的字段副本或 null。
 * 复制及精确键集／数值关联校验失败均返回 null；格式记录配对与政策结果，不创建 Lovers 组件、不修改 Victory 或授予玩家可见性。
 * 反射可执行 Proxy trap，Node 入口须先拒绝危险对象；浏览器消费者应提供无 reviver 的 JSON 数据。
 */
import { copyEventData } from "../inert-event-data";
/** 引擎文案与复盘关联共用这份精确字段事实读取；关系授权及可见投影仍归领域。 */
export const CUPID_EVENT_TYPES = [
  "cupid_lovers_chosen",
  "lover_recognized",
  "cupid_relation_resolved",
  "lovers_death",
] as const;
// 号码对只要求两人不同，保留输入顺序；格式校验不在此重新排序或建立关系。
export function readCupidEventFact(type: string, value: unknown): Record<string, unknown> | null {
  if (!(CUPID_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(value, 4) as Record<string, unknown>;
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const positive = (id: unknown): id is number =>
      typeof id === "number" && Number.isSafeInteger(id) && id > 0;
    const keys = (allowed: string[]) =>
      Object.keys(p).length === allowed.length &&
      Object.keys(p).every((key) => allowed.includes(key));
    if (!positive(p.actorId)) return null;
    if (type === "lover_recognized")
      return keys(["actorId", "partnerId"]) && positive(p.partnerId) && p.partnerId !== p.actorId
        ? p
        : null;
    if (type === "lovers_death")
      return keys(["actorId", "targetId"]) && positive(p.targetId) && p.targetId !== p.actorId
        ? p
        : null;
    if (
      p.day !== 1 ||
      !Array.isArray(p.pairIds) ||
      p.pairIds.length !== 2 ||
      !p.pairIds.every(positive) ||
      p.pairIds[0] === p.pairIds[1]
    )
      return null;
    if (type === "cupid_lovers_chosen") return keys(["actorId", "day", "pairIds"]) ? p : null;
    return keys(["actorId", "day", "policy", "pairIds", "pairCamps", "groupId", "mixed"]) &&
      ["netease_2017_cupid_follows_lovers_v1", "lui_meme_lovers_only_v1"].includes(
        p.policy as string,
      ) &&
      p.groupId === "cupid_lovers" &&
      Array.isArray(p.pairCamps) &&
      p.pairCamps.length === 2 &&
      p.pairCamps.every((camp) => camp === "good" || camp === "wolf") &&
      p.mixed === (p.pairCamps[0] !== p.pairCamps[1])
      ? p
      : null;
  } catch {
    return null;
  }
}
