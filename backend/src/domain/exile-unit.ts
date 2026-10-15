/**
 * 负责实际开票／自爆跳票单位的运行时身份。输入为原已读日次、单位种类及可选原 Animal token；
 * 输出为同一执行的只读单位，PK／王子复收票不再开另一个单位，数字日次不充当唯一 ID。
 * Animal 的 id 直接复用原 token，不复制 completedUnits、到期或付款状态，不决定 skip 是否计数。
 * 元数据只留同一结果，旧 Proxy／同名字段不新读取，不进入事件或 schema2；身份不授权死亡。
 */
import { types } from "node:util";
export interface ExileUnit {
  readonly id: object;
  readonly day: number;
  readonly kind: "exile" | "skipped_day";
}
const units = new WeakSet<object>();
const results = new WeakSet<object>();
const EXILE_UNIT = Symbol("exile_unit");
type ExileBound = { readonly [EXILE_UNIT]: ExileUnit };

/** 只在真实门禁后的单位开启位置调用；普通局独立 token，Animal 复用原权威 token。 */
export function openExileUnit(day: number, kind: ExileUnit["kind"], token?: object): ExileUnit {
  const unit = Object.freeze({ id: token ?? Object.freeze({}), day, kind });
  units.add(unit);
  return unit;
}
export function isExileUnit(unit: unknown): unit is ExileUnit {
  return typeof unit === "object" && unit !== null && units.has(unit);
}
export function attachExileUnit<T extends object>(result: T, unit: ExileUnit): T {
  Object.defineProperty(result, EXILE_UNIT, { value: unit });
  results.add(result);
  return result;
}
/** 品牌只关联结果身份，未保存另一份世界状态；外来对象不会反射新 Symbol。 */
export function exileUnitOf(result: object): ExileUnit | undefined {
  return results.has(result) && !types.isProxy(result)
    ? (result as ExileBound)[EXILE_UNIT]
    : undefined;
}
