/**
 * 负责读取混血儿的榜样选择和胜利归属展示事实。输入为事件名和已确认的惰性数据，输出选定字段或原分支拒绝的 null。
 * 先按浅层描述符取值，再拒绝分支之外的字符串键；symbol 不参与这些键检查，也不输出，数据不递归复制。
 * 归属标签不是当前 Camp 或行动许可；本 reader 不写状态，反射的 Proxy trap／异常仍可传播。
 */
export type HybridEventFact =
  | { type: "hybrid_exemplar_chosen"; actorId: number; day: 1; targetId: number }
  | {
      type: "hybrid_affiliation_resolved";
      actorId: number;
      day: 1;
      targetId: number;
      faction: "good" | "wolf";
    };
export function readHybridEventFact(type: string, payload: unknown): HybridEventFact | null {
  if (type !== "hybrid_exemplar_chosen" && type !== "hybrid_affiliation_resolved") return null;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const prototype = Object.getPrototypeOf(payload),
    descriptors = Object.getOwnPropertyDescriptors(payload);
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    Object.values(descriptors).some((field) => !Object.hasOwn(field, "value") || !field.enumerable)
  )
    return null;
  const p = Object.fromEntries(
    Object.entries(descriptors).map(([key, field]) => [key, field.value]),
  );
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  // 分支允许键在浅层取值之后检查；faction 仅是这份结果标签，不改变真实 Camp。
  const allowed =
    type === "hybrid_exemplar_chosen"
      ? ["actorId", "day", "targetId"]
      : ["actorId", "day", "targetId", "faction"];
  if (
    Object.keys(p).some((key) => !allowed.includes(key)) ||
    !positive(p.actorId) ||
    p.day !== 1 ||
    !positive(p.targetId) ||
    p.actorId === p.targetId
  )
    return null;
  if (type === "hybrid_exemplar_chosen")
    return { type, actorId: p.actorId, day: p.day, targetId: p.targetId };
  return p.faction === "good" || p.faction === "wolf"
    ? {
        type: "hybrid_affiliation_resolved",
        actorId: p.actorId,
        day: p.day,
        targetId: p.targetId,
        faction: p.faction,
      }
    : null;
}
