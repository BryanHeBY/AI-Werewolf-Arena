/**
 * 负责为共享事实 reader 复制惰性事件数据。输入为无 reviver 的 JSON.parse 数据或已确认的惰性值，输出脱离引用的标量、稠密数组或空原型记录。
 * 保留有限数值、容器深度及可枚举数据描述符要求；数组上限由调用方指定，默认一百二十八。原异常向调用方传播，由各 reader 决定是否转为 null。
 * 反射仍可执行 Proxy trap，本模块不是任意 JS 对象的安全净化器；Node 入口负责危险对象拒绝，不在此授予行动或写入领域状态。
 */
export function copyEventData(value: unknown, maxArrayLength = 128, depth = 0): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  // 标量先返回，深度限制针对后续容器；undefined、函数及非有限数值不能通过该分支。
  if (!value || typeof value !== "object" || depth > 3) throw new Error("event_fact_not_data");
  const array = Array.isArray(value),
    prototype = Object.getPrototypeOf(value),
    descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    (array
      ? prototype !== Array.prototype
      : prototype !== Object.prototype && prototype !== null) ||
    Object.getOwnPropertySymbols(value).length
  )
    throw new Error("event_fact_not_plain");
  // 只复制可枚举数据描述符；不调用普通属性 getter，但上面的 Proxy 反射 trap 仍可执行或抛错。
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, field] of Object.entries(descriptors)) {
    if (array && key === "length") continue;
    if (!field.enumerable || !Object.hasOwn(field, "value")) throw new Error("event_fact_accessor");
    result[key] = copyEventData(field.value, maxArrayLength, depth + 1);
  }
  if (!array) return result;
  // 子项先复制，再检查数组长度及索引覆盖；稀疏数组或额外键不能伪装成合法稠密数组。
  const length = descriptors.length?.value;
  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maxArrayLength ||
    Object.keys(result).length !== length
  )
    throw new Error("event_fact_array");
  return Array.from({ length }, (_, index) => {
    if (!Object.hasOwn(result, String(index))) throw new Error("event_fact_sparse");
    return result[String(index)];
  });
}
