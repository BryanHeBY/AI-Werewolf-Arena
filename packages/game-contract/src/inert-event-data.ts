/**
 * Responsibility: copy inert event payload data for shared fact readers.
 * Input: JSON.parse data without revivers, or already proven inert values;
 * output: detached primitives, dense arrays and null-prototype records.
 * Limits and rejection codes preserve the original shared-reader contract:
 * depth three, caller-selected array bound (default 128), finite numbers and
 * enumerable data descriptors only. This browser-compatible reader may trigger
 * Proxy reflection; Node ingress must reject hostile proxies before calling it.
 * It grants no action authority and owns no domain state or filesystem access.
 */
export function copyEventData(value: unknown, maxArrayLength = 128, depth = 0): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
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
  const result: Record<string, unknown> = Object.create(null);
  for (const [key, field] of Object.entries(descriptors)) {
    if (array && key === "length") continue;
    if (!field.enumerable || !Object.hasOwn(field, "value")) throw new Error("event_fact_accessor");
    result[key] = copyEventData(field.value, maxArrayLength, depth + 1);
  }
  if (!array) return result;
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
