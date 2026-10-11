import { types } from "node:util";
/** Inspect only plain own data; original runtime identities are never reconstructed from this copy. */
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
    const descriptors = Object.getOwnPropertyDescriptors(value),
      result: Record<string, unknown> = {};
    if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string"))
      throw new Error(errorCode);
    for (const [key, d] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!("value" in d) || !d.enumerable) throw new Error(errorCode);
      Object.defineProperty(result, key, {
        enumerable: true,
        value: snapshotPlainData(d.value, seen, depth + 1, arrayLimit, errorCode),
      });
    }
    if (!array) return result;
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
    seen.delete(value);
  }
}
