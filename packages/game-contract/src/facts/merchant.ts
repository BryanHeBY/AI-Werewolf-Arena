/**
 * 负责读取奇迹商人的现有展示事实。输入为事件名和已确认的惰性数据，输出选出的交易字段或原浅层／分支校验拒绝的 null。
 * 未使用字段与 symbol 不输出；结算候选保留原 unknown outcome 值，调用方先生成技能文案，再校验该结果字段。
 * 这是分步展示读取，不是严格归档格式或交易许可，不写库存；反射的 Proxy trap／异常不在此捕获。
 */
type Trade = {
  actorId: number;
  day: number;
  targetId: number;
  skill: "check" | "poison" | "guard";
};
/** 已读出的结算前缀尚未证明 outcome 合法，不得据此授权或结算交易。 */
export type MerchantRenderableFact =
  | { type: "merchant_trade_skipped"; actorId: number; day: number }
  | ({ type: "merchant_trade_committed" } & Trade)
  | ({ type: "merchant_trade_resolved"; outcome: unknown } & Trade);
export function readMerchantRenderableFact(
  type: string,
  payload: unknown,
): MerchantRenderableFact | null {
  if (
    !["merchant_trade_committed", "merchant_trade_skipped", "merchant_trade_resolved"].includes(
      type,
    )
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
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (!positive(p.actorId) || !positive(p.day)) return null;
  const actor = p.actorId,
    day = p.day;
  if (type === "merchant_trade_skipped")
    return { type: "merchant_trade_skipped", actorId: actor, day };
  if (!positive(p.targetId) || !["check", "poison", "guard"].includes(p.skill)) return null;
  const trade = { actorId: actor, day, targetId: p.targetId, skill: p.skill as Trade["skill"] };
  if (type === "merchant_trade_committed") return { type, ...trade };
  return { type: "merchant_trade_resolved", ...trade, outcome: p.outcome };
}
/** 展示调用方先生成技能文案，再执行这一结果字段校验；保留原读取与失败顺序。 */
export function readMerchantOutcome(value: unknown): "granted" | "backlash" | null {
  return value === "granted" || value === "backlash" ? value : null;
}
