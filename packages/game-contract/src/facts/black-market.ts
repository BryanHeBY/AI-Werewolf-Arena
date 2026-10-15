/**
 * 负责读取黑市商人的现有展示事实。输入为事件名和已确认的惰性数据，输出选出的交易字段，或在原浅层／分支校验不通过时返回 null。
 * 未使用的字段与 symbol 不输出；结算候选仍保留原 unknown outcome 值，须在调用方生成技能文案后进行第二步校验。
 * 这不是严格归档格式，也不提交交易或修改库存；反射的 Proxy trap 与异常不在此捕获，入口须另行约束对象来源。
 */
type Trade = { actorId: number; day: number; targetId: number; skill: "check" | "poison" | "gun" };
/** 已读出的结算前缀尚未证明 outcome 合法，不能作为严格归档结构。 */
export type BlackMarketRenderableFact =
  | { type: "black_market_trade_skipped"; actorId: number; day: number }
  | ({ type: "black_market_trade_committed" } & Trade)
  | ({ type: "black_market_trade_resolved"; outcome: unknown } & Trade);
export function readBlackMarketRenderableFact(
  type: string,
  payload: unknown,
): BlackMarketRenderableFact | null {
  if (
    ![
      "black_market_trade_committed",
      "black_market_trade_skipped",
      "black_market_trade_resolved",
    ].includes(type)
  )
    return null;
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
  const positive = (v: unknown): v is number =>
    typeof v === "number" && Number.isSafeInteger(v) && v > 0;
  if (!positive(p.actorId) || !positive(p.day)) return null;
  if (type === "black_market_trade_skipped")
    return { type: "black_market_trade_skipped", actorId: p.actorId, day: p.day };
  if (
    !positive(p.targetId) ||
    p.actorId === p.targetId ||
    !["check", "poison", "gun"].includes(p.skill)
  )
    return null;
  const trade = {
    actorId: p.actorId,
    day: p.day,
    targetId: p.targetId,
    skill: p.skill as Trade["skill"],
  };
  if (type === "black_market_trade_committed") return { type, ...trade };
  return { type: "black_market_trade_resolved", ...trade, outcome: p.outcome };
}
/** 展示调用方先生成技能文案，再执行这一结果字段校验；保留原读取与失败顺序。 */
export function readBlackMarketOutcome(value: unknown): "granted" | "backlash" | null {
  return value === "granted" || value === "backlash" ? value : null;
}
