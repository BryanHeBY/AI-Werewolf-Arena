/**
 * 负责把普通自有数据复制为脱离原存储的值；输入任意值和递归限制，输出新对象／数组或原始值。
 * 拒绝 Node Proxy、访问器、符号键、非有限数、循环和超限结构；不执行字段 getter。
 * 结果只携带数据，不能重建原体身份、租约或提交权限；本函数不安装状态或修改来源对象。
 */
import { types } from "node:util";
/** seen 跟踪当前递归路径；同一非循环对象被多处引用时，各处分别复制。 */
export function snapshotPlainData(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
  arrayLimit = 256,
  errorCode = "plain_data_invalid",
): unknown {
  if (
    value === null ||
    ["string", "boolean"].includes(typeof value) ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  if (!value || typeof value !== "object" || types.isProxy(value) || depth > 16 || seen.has(value))
    throw new Error(errorCode);
  const array = Array.isArray(value),
    prototype = Object.getPrototypeOf(value);
  if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null)
    throw new Error(errorCode);
  seen.add(value);
  try {
    // 一次取得自身描述符，再递归处理 value；不用普通属性读取触发调用方访问器。
    const descriptors = Object.getOwnPropertyDescriptors(value),
      result: Record<string, unknown> = {};
    if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string"))
      throw new Error(errorCode);
    for (const [key, d] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!("value" in d) || !d.enumerable) throw new Error(errorCode);
      // defineProperty 能安全承载名为 __proto__ 的数据键；对象副本字段默认不可写、不可配置。
      Object.defineProperty(result, key, {
        enumerable: true,
        value: snapshotPlainData(d.value, seen, depth + 1, arrayLimit, errorCode),
      });
    }
    if (!array) return result;
    // 数组必须稠密、只含索引且不超过限制；最终返回的新数组保持普通可写数组行为。
    const length = descriptors.length?.value;
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > arrayLimit ||
      Object.keys(result).length !== length ||
      !Array.from({ length }, (_, i) => Object.hasOwn(result, i)).every(Boolean)
    )
      throw new Error(errorCode);
    return Array.from({ length }, (_, i) => result[i]);
  } finally {
    // 无论返回还是抛错都退出当前路径，调用方传入的其它 seen 标记不在此清除。
    seen.delete(value);
  }
}
