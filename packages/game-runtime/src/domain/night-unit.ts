/**
 * 负责真实夜间尝试的运行时身份。输入是准备夜间生命周期时已捕获的日次；
 * 输出为独立身份与同引用的只读元数据，不根据 day+1 推断另一夜。
 * 所有者仍是原流水线及交接接收方；身份不授予能力、存活或资源权限。
 * 同一结果的元数据不可枚举，旧结果／Proxy 不读取新增属性，不进入事件或 schema2。
 */
import { types } from "node:util";
export interface NightUnit {
  readonly id: symbol;
  readonly day: number;
}
const units = new WeakSet<object>();
const results = new WeakSet<object>();
const NIGHT_UNIT = Symbol("night_unit");
type NightBound = { readonly [NIGHT_UNIT]: NightUnit };

/** 每个真实 prepare 尝试独立创建，不查询 World、时钟或游戏 RNG。 */
export function openNightUnit(day: number): NightUnit {
  const unit = Object.freeze({ id: Symbol("night"), day });
  units.add(unit);
  return unit;
}
export function isNightUnit(unit: unknown): unit is NightUnit {
  return typeof unit === "object" && unit !== null && units.has(unit);
}
/** 元数据留在同一夜间对象；品牌只保存身份，不建立另一份 World 状态。 */
export function attachNightUnit<T extends object>(result: T, unit: NightUnit | undefined): T {
  if (!isNightUnit(unit)) return result;
  Object.defineProperty(result, NIGHT_UNIT, { value: unit });
  results.add(result);
  return result;
}
/** 外部旧对象即使有同名 getter 或 Proxy，也不触发新增反射读取。 */
export function nightUnitOf(result: object): NightUnit | undefined {
  return results.has(result) && !types.isProxy(result)
    ? (result as NightBound)[NIGHT_UNIT]
    : undefined;
}
