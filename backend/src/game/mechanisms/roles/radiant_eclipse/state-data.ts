/**
 * 明辉／黯月共享的政策字节与严格 scalar 读取规则。两个真实状态 reader 使用同一实现，
 * Proxy 在反射之前拒绝，字段只读 data descriptor，既不调用 getter 也不安装能力。
 * 正整数上界、普通／null prototype 和精确 key 集合均沿用旧接受集合。
 */
import { types } from "node:util";

export const RADIANT_ECLIPSE_POLICY = "awa_radiant_eclipse_v1" as const;

export function record(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value)) return;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return;
  // 只读取 descriptor 的 value，拒绝 accessor；非枚举数据字段仍按旧规则允许。
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== keys.length) return;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const field = fields[key];
    if (!field || !("value" in field)) return;
    out[key] = field.value;
  }
  return out;
}

export function positive(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
