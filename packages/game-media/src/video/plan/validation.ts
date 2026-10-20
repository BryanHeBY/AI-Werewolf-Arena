/**
 * 负责视频编译的有限值与纯 JSON 参数校验。输入为脚本值，输出原值或既有有限错误码。
 * 各编译阶段共用错误语义，不读取归档、状态或渲染环境。
 */
export function fail(reason: string): never {
  throw new Error(`video_${reason}`);
}
export function integer(value: number, name: string, min = 0): number {
  if (!Number.isSafeInteger(value) || value < min) fail(`${name}_invalid`);
  return value;
}
export function finite(value: number, name: string, min = -Infinity, max = Infinity): number {
  if (!Number.isFinite(value) || value < min || value > max) fail(`${name}_invalid`);
  return value;
}
export function nonempty(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${name}_invalid`);
  return value;
}
export function json(value: unknown): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach(json);
    return;
  }
  if (
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    Object.values(value).forEach(json);
    return;
  }
  fail("custom_props_not_json");
}
